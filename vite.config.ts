import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../dist'
  },
  resolve: {
    alias: {
      "@": "/client/src",
      "@shared": "/shared"
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/data/media': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})