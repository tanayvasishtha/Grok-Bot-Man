import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { host: '::', port: 47331, strictPort: true },
  preview: { host: '::', port: 47331, strictPort: true },
})
