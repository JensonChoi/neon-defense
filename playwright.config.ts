import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: 'tests/browser', timeout: 30000, fullyParallel: false,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
