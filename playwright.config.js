const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 45000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: {
    command: 'node test/e2e/server.js',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      NODE_ENV: 'test',
      PLAYWRIGHT_PORT: '4173',
      DATABASE_URL: 'postgresql://playwright:playwright@127.0.0.1:1/haitani_e2e',
      PGHOST: '127.0.0.1',
      PGPORT: '1',
      PGDATABASE: 'haitani_e2e',
      PGUSER: 'playwright',
      PGPASSWORD: 'playwright',
      TEST_DATABASE_URL: ''
    }
  }
});
