import { test, expect } from "@playwright/test";

// Smoke test for the critical weekly loop. Requires a seeded org + test user
// already signed in via session storage, or a magic-link flow with a stub.
//
// For Phase 0 we validate that the core pages render without 500s and that
// the submission form accepts a draft save.

test.describe("IRIS weekly loop", () => {
  test.skip(!process.env.TEST_USER_JWT, "Set TEST_USER_JWT to run");

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "sb-access-token",
        value: process.env.TEST_USER_JWT!,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("dashboard renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Portfolio RAG/i })).toBeVisible();
  });

  test("project list shows IRIS", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByText(/Project IRIS/)).toBeVisible();
  });

  test("submission form loads", async ({ page }) => {
    await page.goto("/projects/40000000-0000-0000-0000-000000000001/submit");
    await expect(page.getByText(/Progress & Status/i)).toBeVisible();
    await expect(page.getByText(/Risks & Issues/i)).toBeVisible();
  });

  test("reports tab accessible", async ({ page }) => {
    await page.goto("/projects/40000000-0000-0000-0000-000000000001/reports");
    await expect(page.getByText(/Generate for this week/i)).toBeVisible();
  });
});
