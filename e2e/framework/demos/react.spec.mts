/** React playground: a social feed with a composer, reactions, saves and transient reply UI. */
import { test, expect, openApp, grab } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('feed: compose, like, save and filter to saved posts', async ({ page }) => {
  const box = page.getByLabel('What are you building?');
  const post = page.getByRole('button', { name: 'Post', exact: true });
  await expect(page.getByTestId('composer-count')).toHaveText('280');
  await expect(post).toBeDisabled();
  await box.fill('Shipping the grab demo');
  await expect(page.getByTestId('composer-count')).toHaveText('258');
  await checkpoint(page, 'feed-composer-ready');
  await post.click();
  await expect(page.locator('.post-text').first()).toHaveText('Shipping the grab demo');
  await expect(box).toHaveValue('');
  await checkpoint(page, 'feed-new-post-rendered');

  const mia = page.getByTestId('post').nth(1);
  const like = mia.getByRole('button', { name: 'Like post' });
  await like.click();
  await expect(like).toContainText('49');
  await checkpoint(page, 'feed-like-incremented');
  await like.click();
  await expect(like).toContainText('48');

  await mia.getByRole('button', { name: 'Save post' }).click();
  await page.getByRole('button', { name: 'Saved only' }).click();
  await expect(page.getByTestId('post').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId('post').filter({ visible: true }).locator('.post-name')).toHaveText('Mia Chen');
  await checkpoint(page, 'feed-saved-only-filter');
  await mia.getByRole('button', { name: 'Save post' }).click();
  await expect(page.getByText('No posts in this view.')).toBeVisible();
  await checkpoint(page, 'feed-unsaved-empty-state');
});

test('grabs resolve the Post component for a newly composed post and for transient reply UI', async ({ page }) => {
  await page.getByLabel('What are you building?').fill('Fresh from the composer');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const fresh = await grab(page, page.locator('.post-text').first());
  expect(fresh).toContain('Fresh from the composer');
  expect(fresh).toMatch(/^in Post at src\/App\.jsx:\d+:\d+$/m);

  await page.getByRole('button', { name: 'Reply to post' }).nth(1).click();
  const reply = page.locator('.reply-popover');
  await expect(reply).toBeVisible();
  await checkpoint(page, 'feed-real-reply-popover');
  // Hold-to-grab is ignored while a text field has focus, so typing shortcuts keep working.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const snippet = await grab(page, reply.locator('.reply-input'));
  expect(snippet).toMatch(/^in Post at src\/App\.jsx:\d+:\d+$/m);
});
