import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const OUTPUT_DIR = '.output/public'

test.describe('Build Output Tests', () => {
  test('should generate main HTML files', async () => {
    // Check main index.html exists
    expect(existsSync(join(OUTPUT_DIR, 'index.html'))).toBe(true)

    // Check posts index exists
    expect(existsSync(join(OUTPUT_DIR, 'posts/index.html'))).toBe(true)

    // Check users index exists
    expect(existsSync(join(OUTPUT_DIR, 'users/index.html'))).toBe(true)
  })

  test('should generate custom output path file (potato.html)', async () => {
    // This tests the custom outputPath configuration from vite.config.ts
    expect(existsSync(join(OUTPUT_DIR, 'potato.html'))).toBe(true)

    const content = readFileSync(join(OUTPUT_DIR, 'potato.html'), 'utf-8')
    expect(content).toContain('Links')
  })

  test('should generate dynamic route HTML files', async () => {
    // Check dynamic user pages (1-10)
    for (let i = 1; i <= 10; i++) {
      expect(existsSync(join(OUTPUT_DIR, `users/${i}/index.html`))).toBe(true)
    }

    // Check dynamic post pages (1-10)
    for (let i = 1; i <= 10; i++) {
      expect(existsSync(join(OUTPUT_DIR, `posts/${i}/index.html`))).toBe(true)
      expect(existsSync(join(OUTPUT_DIR, `posts/${i}/deep/index.html`))).toBe(true)
    }
  })

  test('should include static assets', async () => {
    // Check favicon files are copied
    expect(existsSync(join(OUTPUT_DIR, 'favicon.ico'))).toBe(true)
    expect(existsSync(join(OUTPUT_DIR, 'favicon.png'))).toBe(true)

    // Check script files are copied
    expect(existsSync(join(OUTPUT_DIR, 'script.js'))).toBe(true)
    expect(existsSync(join(OUTPUT_DIR, 'script2.js'))).toBe(true)

    // Check PWA manifest
    expect(existsSync(join(OUTPUT_DIR, 'site.webmanifest'))).toBe(true)
  })

  test('should generate JS/CSS bundles', async () => {
    // Check main JS bundle exists
    const assetsDir = join(OUTPUT_DIR, 'assets')
    expect(existsSync(assetsDir)).toBe(true)

    // Check for main CSS file
    expect(existsSync(join(assetsDir, 'app-B2psSb5c.css'))).toBe(true)

    // Check for main JS file
    expect(existsSync(join(assetsDir, 'main-B9VBR1oB.js'))).toBe(true)
  })

  test('should generate layout pages', async () => {
    // Check layout pages based on vite config outputPath function
    expect(existsSync(join(OUTPUT_DIR, 'layout-a/index.html'))).toBe(true)
    expect(existsSync(join(OUTPUT_DIR, 'layout-b/index.html'))).toBe(true)
  })

  test('should generate redirect pages', async () => {
    // Check redirect pages are generated
    expect(existsSync(join(OUTPUT_DIR, 'redirect/index.html'))).toBe(true)
    expect(existsSync(join(OUTPUT_DIR, 'redirect/internal/index.html'))).toBe(true)
    expect(existsSync(join(OUTPUT_DIR, 'redirect/external/index.html'))).toBe(true)
  })

  test('should handle special characters in routes', async () => {
    // Check that Korean route is properly generated
    // This is based on the 대한민국.tsx route file we saw
    const koreanRoute = join(OUTPUT_DIR, '대한민국/index.html')
    expect(existsSync(koreanRoute)).toBe(true)
  })

  test('should generate prerendered pages with correct content', async () => {
    // Check that index.html contains expected content
    const indexContent = readFileSync(join(OUTPUT_DIR, 'index.html'), 'utf-8')
    expect(indexContent).toContain('Welcome Home!')

    // Check that posts page contains expected content
    const postsContent = readFileSync(join(OUTPUT_DIR, 'posts/index.html'), 'utf-8')
    expect(postsContent).toContain('Posts')

    // Check that users page contains expected content
    const usersContent = readFileSync(join(OUTPUT_DIR, 'users/index.html'), 'utf-8')
    expect(usersContent).toContain('Users')
  })
})