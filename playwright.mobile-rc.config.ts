import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './browser-tests',
  testMatch: 'mobile-rc.spec.ts',
  outputDir: 'test-results/mobile-rc',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'iphone-touch-chromium-portrait',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
    {
      name: 'iphone-touch-chromium-landscape',
      use: {
        ...devices['iPhone 13 landscape'],
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
    {
      name: 'android-touch-chrome-portrait',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
    {
      name: 'android-touch-chrome-landscape',
      use: {
        ...devices['Pixel 7 landscape'],
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
  ],
})
