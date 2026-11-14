import { expect, test } from "@playwright/test";

const browserErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => expect(browserErrors.get(page)).toEqual([]));

test("Solid catalog signals, Show branches, For items and native inputs stay interactive", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Objects for everyday rituals." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("solid-desktop.png"),
    fullPage: true,
  });
  await expect(page.getByTestId("product-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Add Arc lamp to bag" }).click();
  await page.getByRole("button", { name: "Add Arc lamp to bag" }).click();
  await expect(page.getByTestId("bag-count")).toHaveText("2");
  await expect(page.getByTestId("bag-total")).toHaveText("$178");
  await page
    .getByRole("button", { name: "Decrease Arc lamp quantity" })
    .click();
  await expect(page.getByTestId("bag-total")).toHaveText("$89");
  await page.getByRole("button", { name: "Save Pebble vase" }).click();
  await page.getByRole("button", { name: "Saved only" }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Pebble vase" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Saved only" }).click();
  await page
    .getByRole("searchbox", { name: "Search objects" })
    .fill("nothing-matches");
  await expect(page.getByText("No objects found.")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(3);
  await page
    .getByRole("textbox", { name: "Gift note" })
    .fill("Keep native typing and selection.");
  await page
    .getByRole("textbox", { name: "Gift note" })
    .press("ControlOrMeta+a");
  await page
    .getByRole("textbox", { name: "Gift note" })
    .press("ControlOrMeta+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Keep native typing and selection.",
  );
  await expect(page.getByRole("textbox", { name: "Gift note" })).toHaveValue(
    "Keep native typing and selection.",
  );
  await page.getByRole("button", { name: "Clear bag" }).click();
  await expect(page.getByText("Your bag is a blank canvas.")).toBeVisible();
});

test("real Solid component context and queued comment preserve component/source semantics", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Arc lamp to bag" }).click();
  await expect(page.locator(".bag-items strong")).toHaveAttribute(
    "data-point-grab-component", "BagPanel",
  );
  await expect(page.locator(".bag-items strong")).toHaveAttribute(
    "data-point-grab-source", /^src\/App\.tsx:\d+:\d+$/,
  );
  const target = page.getByRole("heading", { name: "Arc lamp" });
  await target.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await page.keyboard.press("ControlOrMeta+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Arc lamp",
  );
  await expect(page.locator("#__point-grab-overlay__")).not.toBeVisible();
  await page.evaluate(() => getSelection()?.removeAllRanges());
  await page.keyboard.down("Control");
  await page.keyboard.down("c");
  await target.hover();
  await target.click();
  await page.keyboard.up("c");
  await page.keyboard.up("Control");
  await expect(page.locator("#__point-grab-toast__")).toContainText(
    "Copied to clipboard",
  );
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toContain("ProductCard");
  expect(snippet).toContain("src/App.tsx:");
  expect(snippet).not.toContain("data-point-grab-");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByText("Add Comment", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add comment" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Add comment" })
    .getByRole("textbox")
    .fill("Make the lamp title more prominent.");
  await page
    .getByRole("button", { name: "Add to Review", exact: true })
    .click();
  await page.getByRole("button", { name: /Confirm & Copy/ }).click();
  const comment = await page.evaluate(() => navigator.clipboard.readText());
  expect(comment).toContain("Make the lamp title more prominent.");
  expect(comment).toContain("ProductCard");
});

test("Solid demo captures a DOM-rendered live-page region without upload or sharing", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByText("Add screenshot", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Select current page region" })).toBeVisible();
  await page.mouse.move(144, 100);
  await page.mouse.down();
  await page.mouse.move(576, 400, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByRole("dialog", { name: "Review screenshot" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Selected screenshot region"),
  ).toHaveJSProperty("naturalWidth", 432);
  await expect(
    page.getByAltText("Selected screenshot region"),
  ).toHaveJSProperty("naturalHeight", 300);
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Review this Solid storefront region.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile layout keeps collection, filtering and bag controls reachable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Essentials", exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Add Everyday tote to bag" }).click();
  await expect(page.getByTestId("bag-count")).toHaveText("1");
  await expect(page.getByTestId("bag-total")).toHaveText("$28");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("solid-mobile.png"),
    fullPage: true,
  });
});
