import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/app'),
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'src/app/dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'], icons: ['lucide-react'] } } }
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true }
});