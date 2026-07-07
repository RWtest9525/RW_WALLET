import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: false, // Prevents generating .map files that expose original code
    minify: 'esbuild', // Heavily minifies/compresses the code
  },
});
