import { test, expect } from '@playwright/test';

const SEL = {
  captureHint: '[data-point-grab-btn="captureHint"]',
  endCapture: '[data-point-grab-btn="copyPrompt"]',
  comment: '#__point-grab-comment-popover__',
} as const;

test.describe('React guided capture-session walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('guides a real two-target session through aggregate prompt completion', async ({ page }) => {
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.locator('.post-actions').first()).toHaveClass(/walkthrough-target/);

    // Open the conditional UI before starting the persistent capture session.
    await page.locator('.reply-btn').first().click();
    await expect(page.locator('.reply-popover').first()).toBeVisible();

    await page.locator(SEL.captureHint).click();
    await expect(page.locator(SEL.endCapture)).toHaveAccessibleName(/End Capture Mode/);

    await page.locator('[data-point-grab-btn="actions"]').click();
    await page.getByRole('menuitem', { name: 'Add Comment' }).click();
    await page.locator('.post-actions').first().click();
    await page.locator(`${SEL.comment} textarea`).fill('Make the action row easier to scan.');
    await page.locator(`${SEL.comment} button`, { hasText: 'Accept' }).click();

    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await expect(page.getByTestId('prompt-preview')).toContainText('Make the action row easier to scan.');

    // Skip is a real session action and must not end the capture session.
    await page.locator('.reply-popover').first().click();
    await page.locator(`${SEL.comment} button`, { hasText: 'Skip' }).click();
    await expect(page.locator(SEL.endCapture)).toHaveAccessibleName(/End Capture Mode/);

    await page.locator('.reply-popover').first().click();
    await page.locator(`${SEL.comment} textarea`).fill('Keep the reply composer visible while I write.');
    await page.locator(`${SEL.comment} button`, { hasText: 'Accept' }).click();

    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(page.getByTestId('prompt-preview')).toContainText('## Element 2');

    await page.locator(SEL.endCapture).click();
    await expect(page.getByTestId('walkthrough-complete')).toBeVisible();
    await expect(page.getByTestId('walkthrough-complete')).toContainText('2 reviewed elements + comments are ready for your AI agent.');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    await expect(page.getByTestId('prompt-preview')).toHaveText(clipboard);
    expect(clipboard).toContain('App.jsx');
    expect(clipboard).toContain('Make the action row easier to scan.');
    expect(clipboard).toContain('Keep the reply composer visible while I write.');
  });
});
