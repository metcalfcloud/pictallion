// vitest.config.ts
import { defineConfig } from 'vitest/config';
import viteTsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [viteTsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Only run unit tests in tests/
    include: ["tests/**/*.test.ts"],
    exclude: [
      'tests/**/*.spec.ts',
      'tests/puppeteer/**/*.js'
    ]
  }
});