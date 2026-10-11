import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: 'tests/browser', timeout: 60000, fullyParallel: false,
    expect: { timeout: 10000 },
    use: {
      ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 },
      baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure',
      // Linux CI runners render the trusted local game without a hardware GPU.
      launchOptions: {
        args: process.platform === 'linux'
          ? ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
          : [],
      },
    },
    webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
