import { test, expect, type Locator, type Page } from "@playwright/test";
import { SEL, activateInspector } from "./helpers";

const COMMENT_POPOVER = "#__point-grab-comment-popover__";

async function selectForComment(page: Page, target: Locator, comment: string) {
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await expect(page.locator(SEL.overlay)).toBeVisible({ timeout: 5_000 });
  await target.click();
  await expect(page.locator(COMMENT_POPOVER)).toBeVisible();
  await page.locator(`${COMMENT_POPOVER} textarea`).fill(comment);
  await page.getByRole("button", { name: "Add to Review" }).click();
}

test.describe("site LiveDemo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#tour-instruction")).toContainText(
      "Build one AI-ready review",
    );
  });

  test("walks through a multi-element comment review and copies one batch", async ({
    page,
  }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await activateInspector(page);

    await page.locator('[data-point-grab-btn="actions"]').click();
    await page.getByRole("menuitem", { name: "Add Comment" }).click();

    await selectForComment(
      page,
      page.locator("#progress-pct"),
      "Make this metric easier to scan.",
    );
    await expect(page.locator(SEL.toastVisible)).toContainText(
      "Review item 1 added",
    );
    await expect(
      page.getByRole("button", { name: "Confirm & Copy 1 reviewed element" }),
    ).toBeVisible();

    await selectForComment(
      page,
      page.locator("#progress-bar"),
      "Make the progress state more prominent.",
    );
    await expect(page.locator(SEL.toastVisible)).toContainText(
      "Review item 2 added",
    );

    await page
      .getByRole("button", { name: "Confirm & Copy 2 reviewed elements" })
      .click();
    await expect(page.locator(SEL.toastVisible)).toContainText(
      "Confirmed & copied 2 reviewed elements",
    );
    await expect(page.locator("#tour-complete")).toBeVisible();
    await expect(page.locator("#tour-complete")).toContainText(
      "one AI-ready prompt",
    );
    await expect(page.locator(".tour-dot")).toHaveClass(/done/);
    await expect(page.locator("#tour-chat")).toHaveCount(0);
    await expect(page.locator("#tour-continue-btn")).toHaveCount(0);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("Make this metric easier to scan.");
    expect(clipboard).toContain("Make the progress state more prominent.");
    expect(clipboard).toContain("## Element 2");
  });
});
