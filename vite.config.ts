import { defineConfig } from 'vitest/config';

// VITE_BASE diset oleh GitHub Actions, contoh: /nusantara-ngawur/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: { outDir: 'dist', assetsDir: 'bundle', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
