import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [viteSingleFile()],
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  build: {
    outDir: 'dist-vite',
    emptyOutDir: true,
    assetsInlineLimit: 100000000
  }
});
