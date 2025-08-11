// frontend/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Stub Tauri core API during unit tests
      "@tauri-apps/api/core": path.resolve(
        __dirname,
        "./tests/mocks/tauri-core.ts",
      ),
      "@tauri-apps/api/tauri": path.resolve(
        __dirname,
        "./tests/mocks/tauri-core.ts",
      ),
      "@vladmandic/face-api": path.resolve(
        __dirname,
        "./tests/mocks/face-api.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/puppeteer/**/*.js"],
    // Mock Tauri APIs in test environment
    env: {
      TAURI_PLATFORM: "test",
      TAURI_ARCH: "test",
      TAURI_FAMILY: "test",
      TAURI_PLATFORM_VERSION: "test",
      TAURI_PLATFORM_TYPE: "test",
    },
  },
});
