import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    // Remove async plugin loading for synchronous config
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: {
      host: "0.0.0.0",
    },
    allowedHosts: [
      "3e624656-e3b6-4a34-9586-db6d05f7181a-00-1s155afxkxjum.worf.replit.dev",
      ".replit.dev"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});