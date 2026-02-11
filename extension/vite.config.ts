import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        settings: resolve(__dirname, 'src/settings/index.html'),
        worker: resolve(__dirname, 'src/background/worker.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        inlineDynamicImports: false,
      },
    },
    modulePreload: false,
  },
});
