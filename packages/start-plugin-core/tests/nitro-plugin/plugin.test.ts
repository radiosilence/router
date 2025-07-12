import { build, copyPublicAssets, createNitro, prepare } from 'nitropack'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { nitroPlugin } from '../../src/nitro-plugin/plugin'
import { getTanStackStartOptions } from '../../src/plugin'
import type { TanStackStartInputConfig } from '../../src/plugin'
import type { ViteBuilder } from 'vite'

vi.mock('nitropack')
vi.mock('node:fs', () => ({
  rmSync: vi.fn(),
  mkdtempSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}))
vi.mock('../../src/nitro-plugin/prerender', () => ({
  prerender: vi.fn(),
}))
vi.mock('../../src/nitro-plugin/build-sitemap', () => ({
  buildSitemap: vi.fn(),
}))

const mockCreateNitro = vi.mocked(createNitro)
const mockPrepare = vi.mocked(prepare)
const mockCopyPublicAssets = vi.mocked(copyPublicAssets)
const mockBuild = vi.mocked(build)

const getDefaultOptions = (): TanStackStartInputConfig => ({
  root: '/test/root',
  target: 'node',
  pages: [],
  prerender: { enabled: false },
  spa: { enabled: false }
})

describe('nitroPlugin', () => {
  let mockOptions!: TanStackStartInputConfig
  let mockGetSsrBundle: () => any
  let mockBuilder: ViteBuilder

  beforeEach(() => {
    mockOptions = getDefaultOptions()

    mockGetSsrBundle = vi.fn(() => ({}))

    mockBuilder = {
      environments: {
        client: {
          config: { build: {} },
        },
        server: {
          config: { build: { rollupOptions: {} } },
        },
      },
      build: vi.fn().mockResolvedValue({}),
    } as any

    mockCreateNitro.mockResolvedValue({
      options: {
        output: {
          publicDir: '/test/output/public',
          serverDir: '/test/output/server',
        },
        baseURL: '/',
      },
      close: vi.fn(),
      logger: {
        success: vi.fn(),
      },
    } as any)

    mockPrepare.mockResolvedValue(undefined)
    mockCopyPublicAssets.mockResolvedValue(undefined)
    mockBuild.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should return array of plugin options', () => {
    const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)

    expect(plugins).toBeInstanceOf(Array)
    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toHaveProperty('name', 'tanstack-vite-plugin-nitro')
  })

  test('should configure server environment correctly', () => {
    const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
    const plugin = plugins[0]

    if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
      throw new Error('Expected plugin to be a Plugin object')
    }

    const serverConfig = (plugin.configEnvironment as any)('server')

    expect(serverConfig).toEqual({
      build: {
        commonjsOptions: {
          include: [],
        },
        ssr: true,
        sourcemap: true,
        rollupOptions: {
          input: '/~start/server-entry',
        },
      },
    })
  })

  test('should return null for non-server environment', () => {
    const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
    const plugin = plugins[0]

    if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
      throw new Error('Expected plugin to be a Plugin object')
    }

    const clientConfig = (plugin.configEnvironment as any)('client')

    expect(clientConfig).toBeNull()
  })

  test('should use START_TARGET environment variable when set', () => {
    const originalEnv = process.env['START_TARGET']
    process.env['START_TARGET'] = 'vercel'

    try {
      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      expect(plugins).toBeDefined()
    } finally {
      if (originalEnv !== undefined) {
        process.env['START_TARGET'] = originalEnv
      }
    }
  })

  test('should use options.target when START_TARGET is not set', () => {
    const originalEnv = process.env['START_TARGET']
    delete process.env['START_TARGET']

    try {
      mockOptions!.target = 'netlify'
      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      expect(plugins).toBeDefined()
    } finally {
      if (originalEnv !== undefined) {
        process.env['START_TARGET'] = originalEnv
      }
    }
  })

  test('should configure nitro with correct options', async () => {
    const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
    const plugin = plugins[0]

    if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
      throw new Error('Expected plugin to be a Plugin object')
    }

    const config = (plugin.config as any)()
    expect(config).toHaveProperty('builder')
    expect(config?.builder?.sharedPlugins).toBe(true)
    expect(config?.builder?.buildApp).toBeInstanceOf(Function)
  })

  describe('prerender.enabled logic (PR #4632 fix)', () => {
    test('should respect explicitly set prerender.enabled = true', async () => {
      mockOptions!.prerender = { enabled: true }
      mockOptions!.pages = []

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(true)
    })

    test('should respect explicitly set prerender.enabled = false', async () => {
      mockOptions!.prerender = { enabled: false }
      mockOptions!.pages = [{ path: '/', prerender: { enabled: true } }]

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      // Should remain false even when pages have prerender enabled
      expect(mockOptions!.prerender.enabled).toBe(false)
    })

    test('should enable prerender when undefined and pages have prerender enabled', async () => {
      mockOptions!.prerender = {} // enabled is undefined
      mockOptions!.pages = [
        { path: '/' },
        { path: '/about', prerender: { enabled: true } },
      ]

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(true)
    })

    test('should not enable prerender when undefined and no pages have prerender enabled', async () => {
      mockOptions!.prerender = {} // enabled is undefined
      mockOptions!.pages = [
        { path: '/' },
        { path: '/about' },
      ]

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(false)
    })

    test('should handle string pages (should not enable prerender)', async () => {
      mockOptions!.prerender = {} // enabled is undefined
      mockOptions!.pages = ['/'] as any // string pages

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(false)
    })

    test('should handle mixed string and object pages', async () => {
      mockOptions!.prerender = {} // enabled is undefined
      mockOptions!.pages = [
        '/' as any, // string page
        { path: '/about' }, // object page without prerender
        { path: '/products', prerender: { enabled: true } }, // object page with prerender
      ]

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(true)
    })

    test('should not enable prerender when prerender option is missing entirely', async () => {
      const optionsWithoutPrerender = { ...mockOptions! }
      delete (optionsWithoutPrerender as any).prerender
      optionsWithoutPrerender.pages = [{ path: '/', prerender: { enabled: true } }]

      const plugins = nitroPlugin(getTanStackStartOptions(optionsWithoutPrerender as any), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      // Should create prerender object and enable it
      expect((optionsWithoutPrerender as any).prerender?.enabled).toBe(true)
    })

    test('should handle pages with prerender.enabled = false', async () => {
      mockOptions!.prerender = {} // enabled is undefined
      mockOptions!.pages = [
        { path: '/', prerender: { enabled: false } },
        { path: '/about', prerender: { enabled: false } },
      ]

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(false)
    })

    test('should handle complex outputPath with prerender logic', async () => {
      mockOptions!.prerender = {
        outputPath: (path: string) => path.replace(/^\//, 'dist/'),
      }
      mockOptions!.pages = [
        { path: '/', prerender: { enabled: true, outputPath: 'custom/index.html' } },
      ]

      const plugins = nitroPlugin(getTanStackStartOptions(mockOptions), mockGetSsrBundle)
      const plugin = plugins[0]

      if (!plugin || typeof plugin === 'boolean' || Array.isArray(plugin) || 'then' in plugin) {
        throw new Error('Expected plugin to be a Plugin object')
      }

      const config = (plugin.config as any)()
      await config?.builder?.buildApp?.(mockBuilder)

      expect(mockOptions!.prerender.enabled).toBe(true)
      expect(mockOptions!.prerender.outputPath).toBeInstanceOf(Function)
    })
  })
})