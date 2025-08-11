import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(() => {
  const shouldStubTauri = process.env.VITE_TAURI_STUB === "1";
  const isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

  const alias: Record<string, string> = {};
  if (shouldStubTauri || isTest) {
    const shim = path.resolve(__dirname, "./src/shims/tauri-core.ts");
    alias["@tauri-apps/api/core"] = shim;
  }

  return {
    plugins: [react()],
    resolve: {
      alias,
    },
    server: {
      host: "0.0.0.0",
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            mui: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
            face: ["@vladmandic/face-api"],
          },
        },
      },
    },
  };
});
