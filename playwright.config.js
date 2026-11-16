import { defineConfig, devices } from '@playwright/test'

const local = !process.env.PRESSURE_TEST_URL
const baseURL = process.env.PRESSURE_TEST_URL || 'http://127.0.0.1:4187'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  workers: 1,
  use: {
    baseURL,
    timezoneId: 'America/Indiana/Indianapolis',
    launchOptions: local ? { args: ['--no-proxy-server'] } : undefined,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: local ? { command: 'npm run preview -- --host 127.0.0.1 --port 4187 --strictPort', url: baseURL } : undefined,
})
