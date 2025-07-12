import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
    pages: [
      {
        path: '/links',
        prerender: { enabled: true, outputPath: '/potato.html' },
      },
    ],
    prerender: {
      enabled: true,
      outputPath: (path) =>
        path.endsWith('index') ? `${path}.html` : `${path}/index.html`,
    }}),
  ],
})
