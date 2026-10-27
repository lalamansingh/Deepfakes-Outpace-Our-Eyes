import { expect, test } from "@playwright/test";

test.describe("player", () => {
  test("plays a full daily round and sees a summary @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Deepfakes outpace/i);
    await page.getByRole("link", { name: /Play today's challenge/i }).first().click();
    await expect(page).toHaveURL(/\/play$/);

    for (let i = 0; i < 8; i++) {
      const choice = i % 2 === 0 ? "Real" : "Rendered";
      await page.getByRole("button", { name: new RegExp(`^${choice}`) }).click();
      await page.getByRole("button", { name: "Lock in answer" }).click();
      await expect(page.locator("#reveal-heading")).toHaveText(/Correct!|Not this time/);
      // the source and licence are always shown after answering
      await expect(page.getByText(/Wikimedia Commons/).first()).toBeVisible();
      await page.getByRole("button", { name: i === 7 ? "See your results" : "Next item" }).click();
    }

    await expect(page.getByText(/You spotted \d of 8 correctly/)).toBeVisible();
    await expect(page.getByText(/Daily challenge complete/i)).toBeVisible();

    // nothing scrolls sideways on a phone
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // coming back the same day shows the finished round instead of a new one
    await page.reload();
    await expect(page.getByRole("heading", { name: "Come back tomorrow" })).toBeVisible();

    await page.goto("/progress");
    await expect(page.getByText(/8/).first()).toBeVisible();
  });

  test("never exposes the answer before the player answers", async ({ page }) => {
    const roundResponse = page.waitForResponse((r) => r.url().endsWith("/api/rounds") && r.request().method() === "POST");
    await page.goto("/practice");
    const body = await (await roundResponse).text();
    expect(body).not.toMatch(/"label"|"clues"|"generator"/);
    await expect(page.getByRole("button", { name: "Lock in answer" }).or(page.getByRole("button", { name: "Pick Real or Rendered" }))).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/Correct!|Not this time|It was/);
  });

  test("sends security headers", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
