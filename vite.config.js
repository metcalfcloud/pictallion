import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";

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
  optimizeDeps: {
    exclude: [
      'react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime',
      '@radix-ui/react-tooltip', '@radix-ui/react-slot', '@radix-ui/react-dialog',
      '@radix-ui/react-label', '@radix-ui/react-checkbox', '@radix-ui/react-progress',
      '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-scroll-area', '@radix-ui/react-separator', '@radix-ui/react-switch',
      '@radix-ui/react-toast', '@radix-ui/react-slider', '@radix-ui/react-collapsible',
      '@radix-ui/react-alert-dialog', 'lucide-react', 'class-variance-authority',
      'clsx', 'tailwind-merge', 'react-hook-form', '@hookform/resolvers/zod', 'zod'
    ],
    force: true
  },
  server: {
    hmr: false,
    fs: {
      strict: false,
      allow: ['..']
    },
  },
});
