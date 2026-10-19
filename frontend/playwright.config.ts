import { defineConfig, devices } from '@playwright/test'

// E2E runs against the dev server with the backend proxied on /api. Both must
// be up: the webServer block starts Vite; start the backend separately
// (cd backend && uv run uvicorn app.main:app --port 8000) or via docker-compose.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  // Unset, Playwright defaults to 50% of the runner's reported CPU count —
  // not tied to CI at all, so the actual concurrency (and therefore how much
  // load hits the one shared backend) silently depends on whatever fleet
  // machine GitHub happens to hand out for a given run. Pinned to 2 to match
  // the backend's LAYOUT_WORKERS=2 compute-pool capacity and everything
  // already measured/tuned against that figure (CI job/step timeouts,
  // per-test timeout bumps for the heavier specs).
  workers: process.env.CI ? 2 : undefined,
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
