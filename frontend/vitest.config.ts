// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      'tests/puppeteer/**/*.js'
    ],
    // Mock Tauri APIs in test environment
    env: {
      TAURI_PLATFORM: 'test',
      TAURI_ARCH: 'test',
      TAURI_FAMILY: 'test',
      TAURI_PLATFORM_VERSION: 'test',
      TAURI_PLATFORM_TYPE: 'test'
    }
  }
});