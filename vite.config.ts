import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          transformers: ['@huggingface/transformers']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    exclude: ['@huggingface/transformers']
  },
  server: {
    host: true
  }
});