import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * End-to-end tests against the production build (run `npm run build` first).
 * Each run starts from an empty embedded database, seeded with the content library.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `rm -rf .data/e2e && npx tsx scripts/seed.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PGLITE_DIR: ".data/e2e/db",
      UPLOAD_DIR: ".data/e2e/uploads",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-e2e",
      ADMIN_EMAIL: "admin@e2e.test",
      ADMIN_PASSWORD: "e2e-admin-password",
    },
  },
});
