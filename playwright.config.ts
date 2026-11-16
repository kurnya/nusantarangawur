import { defineConfig } from '@playwright/test';

const PORT = 4173;
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/pw',
  timeout: 120_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1280, height: 800 },
    // WebGL perangkat lunak (SwiftShader) supaya jalan di CI tanpa GPU
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
  },
});
