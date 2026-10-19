import { defineConfig, devices } from "@playwright/test";

// End-to-end patient flow on a phone-sized Chromium, against the test
// location fixture (never real data).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  // Uses the installed Google Chrome; set PW_BUNDLED=1 after `npx playwright install chromium` to use Playwright's own.
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], ...(process.env.PW_BUNDLED ? {} : { channel: "chrome" }) } }],
  webServer: {
    command: "npm run dev:fixtures",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
