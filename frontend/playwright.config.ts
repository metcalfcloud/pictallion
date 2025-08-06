import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/{tests,e2e}/**/*.spec.ts',
});