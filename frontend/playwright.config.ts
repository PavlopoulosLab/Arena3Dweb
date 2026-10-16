import { defineConfig, devices } from '@playwright/test'

// E2E runs against the dev server with the backend proxied on /api. Both must
// be up: the webServer block starts Vite; start the backend separately
// (cd backend && uv run uvicorn app.main:app --port 8000) or via docker-compose.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  // These drive a WebGL scene, and CI has no GPU — every test renders through
  // software GL and lands in the 15-30s range, so the 30s default was passing
  // on retries alone.
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec\.ts/,
    },
    // phones/tablets: touch, small viewports (e2e/mobile.spec.ts only)
    {
      name: 'phone',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'tablet',
      use: { ...devices['Galaxy Tab S4'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
