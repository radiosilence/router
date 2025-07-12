import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildSitemap } from '../../src/nitro-plugin/build-sitemap'
import type { TanStackStartOutputConfig } from '../../src/plugin'

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
}))

vi.mock('xmlbuilder2', () => ({
  create: vi.fn(() => ({
    ele: vi.fn(() => ({
      ele: vi.fn(() => ({
        txt: vi.fn(),
        att: vi.fn(),
      })),
      txt: vi.fn(),
      att: vi.fn(),
    })),
    com: vi.fn(),
    end: vi.fn(() => '<?xml version="1.0"?><urlset></urlset>'),
  })),
}))

const mockWriteFileSync = vi.mocked(writeFileSync)

describe('buildSitemap', () => {
  let mockOptions: TanStackStartOutputConfig
  const publicDir = '/test/output/public'

  beforeEach(() => {
    mockOptions = {
      pages: [
        {
          path: '/',
          sitemap: {
            lastmod: '2024-01-01',
            priority: 1.0,
            changefreq: 'daily',
          },
        },
        {
          path: '/about',
          sitemap: {
            lastmod: '2024-01-02',
            priority: 0.8,
            changefreq: 'weekly',
          },
        },
        {
          path: '/hidden',
          sitemap: {
            exclude: true,
          },
        },
      ],
      sitemap: {
        enabled: true,
        host: 'https://example.com',
        outputPath: 'sitemap.xml',
      },
    } as TanStackStartOutputConfig
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should build sitemap successfully', () => {
    buildSitemap({ options: mockOptions, publicDir })

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2)
    
    // Check XML sitemap was written
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('sitemap.xml'),
      expect.any(String)
    )
    
    // Check pages.json was written
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('pages.json'),
      expect.stringMatching(/{"pages":.*"host":"https:\/\/example\.com".*"lastBuilt":.*}/)
    )
  })

  test('should exclude pages with sitemap.exclude = true', () => {
    buildSitemap({ options: mockOptions, publicDir })
    
    // Should only write sitemap for non-excluded pages
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle alternateRefs in sitemap', () => {
    mockOptions.pages = [
      {
        path: '/',
        sitemap: {
          alternateRefs: [
            { href: 'https://example.com/es/', hreflang: 'es' },
            { href: 'https://example.com/fr/', hreflang: 'fr' },
          ],
        },
      },
    ]

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle images in sitemap', () => {
    mockOptions.pages = [
      {
        path: '/',
        sitemap: {
          images: [
            {
              loc: 'https://example.com/image1.jpg',
              title: 'Image 1',
              caption: 'First image',
            },
            {
              loc: 'https://example.com/image2.jpg',
            },
          ],
        },
      },
    ]

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle news in sitemap', () => {
    mockOptions.pages = [
      {
        path: '/news/article',
        sitemap: {
          news: {
            publication: {
              name: 'Example News',
              language: 'en',
            },
            publicationDate: '2024-01-01',
            title: 'Breaking News',
          },
        },
      },
    ]

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle host without trailing slash', () => {
    mockOptions.sitemap!.host = 'https://example.com'
    
    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle host with trailing slash', () => {
    mockOptions.sitemap!.host = 'https://example.com/'
    
    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should auto-enable sitemap when pages exist but no explicit config', () => {
    mockOptions.sitemap = undefined
    
    buildSitemap({ options: mockOptions, publicDir })
    
    // Should not write anything without host
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  test('should throw error when sitemap is not enabled', () => {
    mockOptions.sitemap = { enabled: false, outputPath: 'sitemap.xml' }
    
    expect(() => {
      buildSitemap({ options: mockOptions, publicDir })
    }).toThrow('Sitemap is not enabled')
  })

  test('should throw error when host is missing', () => {
    mockOptions.sitemap = {
      enabled: true,
      outputPath: 'sitemap.xml',
    }
    
    expect(() => {
      buildSitemap({ options: mockOptions, publicDir })
    }).toThrow('Sitemap host is not set and required to build the sitemap.')
  })

  test('should throw error when outputPath is missing', () => {
    mockOptions.sitemap = {
      enabled: true,
      host: 'https://example.com',
    }
    
    expect(() => {
      buildSitemap({ options: mockOptions, publicDir })
    }).toThrow('Sitemap output path is not set')
  })

  test('should return early when no pages exist', () => {
    mockOptions.pages = []
    
    buildSitemap({ options: mockOptions, publicDir })
    
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  test('should handle date objects in lastmod', () => {
    mockOptions.pages = [
      {
        path: '/',
        sitemap: {
          lastmod: new Date('2024-01-01T00:00:00Z'),
        },
      },
    ]

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle default lastmod when not provided', () => {
    mockOptions.pages = [
      {
        path: '/',
        sitemap: {},
      },
    ]

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle all changefreq values', () => {
    const changefreqValues = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const
    
    mockOptions.pages = changefreqValues.map((changefreq, index) => ({
      path: `/${index}`,
      sitemap: { changefreq },
    }))

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle news with Date object', () => {
    mockOptions.pages = [
      {
        path: '/news',
        sitemap: {
          news: {
            publication: {
              name: 'Test News',
              language: 'en',
            },
            publicationDate: new Date('2024-01-01'),
            title: 'Test Article',
          },
        },
      },
    ]

    buildSitemap({ options: mockOptions, publicDir })
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should handle error during file writing', () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('Write failed')
    })

    // Should not throw, but log error internally
    expect(() => {
      buildSitemap({ options: mockOptions, publicDir })
    }).not.toThrow()
  })
})