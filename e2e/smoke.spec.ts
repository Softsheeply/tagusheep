import { test, expect, type Page } from "@playwright/test";

// Every top-level route in the app. Dynamic segments use a value that won't
// match a real record so we also exercise each page's "not found" path.
const ROUTES = [
  "/",
  "/tags",
  "/tag/does-not-exist",
  "/brand/does-not-exist",
  "/rn/000000",
  "/style/does-not-exist",
  "/upload",
  "/upload/batch",
  "/upload-guide",
  "/signin",
  "/submit-info",
  "/profile",
  "/favorites",
  "/leaderboard",
  "/import",
  "/import/bulk",
  "/import/csv",
  "/import/paste",
  "/tools",
  "/tools/rn-audit",
  "/tools/rn-audit/bulk-edit",
  "/tools/wanted",
  "/imports-review",
  "/submissions-review",
  "/trash",
  "/export",
  "/privacy",
  "/terms",
  "/admin-test",
  "/storage-test",
  "/mobile",
];

// Console noise that's expected given the fake Firebase env this suite runs
// against (no real project, no network access to Vercel's script CDN) --
// none of this indicates an actual page bug.
const IGNORED_CONSOLE_PATTERNS =
  /firestore|Could not reach|healthy Internet|transport errored|WebChannelConnection|PERMISSION_DENIED|vercel-scripts|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|Failed to load resource|net::ERR_/;

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE_PATTERNS.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    if (IGNORED_CONSOLE_PATTERNS.test(err.message)) return;
    errors.push(err.message);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`${route} loads without crashing or an unexpected console error`, async ({ page }) => {
    const errors = trackConsoleErrors(page);

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${route}`).not.toBeNull();

    // Diagnostic pages are intentionally hidden for invite testing.
    if (route === "/admin-test" || route === "/storage-test") {
      expect(response!.status(), `${route} should be hidden`).toBe(404);
      return;
    }

    expect(response!.status(), `unexpected status for ${route}`).toBeLessThan(500);

    // Pages with a live Firestore listener never go network-idle (the
    // WebChannel connection keeps retrying), so wait a fixed beat instead --
    // long enough for hydration and any async console errors to surface.
    await page.waitForTimeout(2000);

    expect(errors, `unexpected console errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
  });
}
