import { defineConfig, devices } from '@playwright/test';

// Test smoke du parcours nominal. Prérequis : le stack de dev tourne
// (`npm run dev` à la racine — front 5173, API 4000, Realtime 4001, Postgres).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
