/**
 * The package in real browsers (`npm run test:browsers`, plan §13). Always
 * 127.0.0.1, never localhost: the user's saved designs live in localStorage on
 * localhost. `VIES_STUB=1` keeps every server off the real VIES.
 */
import { defineConfig, devices } from '@playwright/test';
import { PORT } from './e2e/ports.js';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // the validation timers are real ones: too many browsers at once make them late
  workers: 6,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // lets the test read back what the real Copy button wrote
        launchOptions: {
          firefoxUserPrefs: { 'dom.events.testing.asyncClipboard': true },
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'phone-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'phone-webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'npm run build && node examples/server.js',
    url: `http://127.0.0.1:${PORT}/examples/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT), VIES_STUB: '1' },
    stdout: 'ignore',
  },
});
