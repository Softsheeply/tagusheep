import { defineConfig, devices } from "@playwright/test";

// Fake-but-valid-shaped Firebase config so the app boots and every page
// renders (Firestore calls will fail against these, which is fine -- the
// smoke suite only asserts each route loads without crashing or logging an
// unexpected console error, not that live data appears).
const FAKE_FIREBASE_ENV = {
  NEXT_PUBLIC_FB_API_KEY: "ci-placeholder-api-key",
  NEXT_PUBLIC_FB_AUTH_DOMAIN: "ci-placeholder.firebaseapp.com",
  NEXT_PUBLIC_FB_PROJECT_ID: "ci-placeholder-project",
  NEXT_PUBLIC_FB_STORAGE_BUCKET: "ci-placeholder-project.firebasestorage.app",
  NEXT_PUBLIC_FB_APP_ID: "1:0000000000:web:0000000000000000000000",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // Pin to the full Chromium binary (not the default headless-shell build):
  // the sandbox this suite is authored in only ships the former, and
  // pointing at it directly avoids an `npx playwright install` download.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: FAKE_FIREBASE_ENV,
  },
});
