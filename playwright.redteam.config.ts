import { defineConfig, devices } from '@playwright/test'

/**
 * Regression coverage for the defects confirmed by the final red-team pass
 * (docs/release-hardening/FINAL_RED_TEAM.md). Kept apart from the release smoke
 * because these cases need a real document lifecycle, a real AudioContext, or
 * real touch input, and because the gesture audit runs on phone profiles.
 *
 * Deliberately NOT reduced-motion: the release smoke and the mobile RC pass both
 * set `reducedMotion: 'reduce'`, which skips Station's power-on animation - and
 * that animation's `animationend` is what enables the whole transport.
 */
const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './browser-tests/redteam',
  outputDir: 'test-results/redteam',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
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
      name: 'chrome',
      testMatch: 'regression.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'iphone-touch',
      testMatch: 'gesture-audit.spec.ts',
      use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome' },
    },
    {
      name: 'android-touch',
      testMatch: 'gesture-audit.spec.ts',
      use: { ...devices['Pixel 7'], browserName: 'chromium', channel: 'chrome' },
    },
  ],
})
