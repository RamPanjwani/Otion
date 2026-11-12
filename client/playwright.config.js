/* global process */
import { defineConfig, devices } from '@playwright/test';

// The suite runs against a real API and MongoDB, not mocks. It uses its own
// database (otion_e2e) so a developer's dev data is never touched, and it seeds
// it through the same script the docs describe.
const MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/otion_e2e';
const API_ORIGIN = 'http://localhost:5000';
const CLIENT_ORIGIN = 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: CLIENT_ORIGIN,
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../server run migrate && npm --prefix ../server run seed && npm --prefix ../server start',
      url: `${API_ORIGIN}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        MONGO_URI,
        JWT_SECRET: 'e2e-only-jwt-secret-not-used-in-production',
        CLIENT_URLS: `${CLIENT_ORIGIN},http://127.0.0.1:4173`,
        PORT: '5000',
        NODE_ENV: 'e2e',
      },
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: CLIENT_ORIGIN,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        VITE_API_URL: `${API_ORIGIN}/api`,
        VITE_SOCKET_URL: API_ORIGIN,
      },
    },
  ],
});
