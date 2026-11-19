/** Vanilla playground: a music player whose state Point Grab must capture as it is now. */
import { test, expect, openApp, grab } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('player: transport, likes, queue filter and seeking all work', async ({ page }) => {
  const title = page.locator('#track-title');
  await page.locator('#btn-next').click();
  await expect(title).toHaveText('Midnight Circuit');
  await checkpoint(page, 'player-next-track');
  await expect(page.getByRole('button', { name: 'Play Midnight Circuit' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-prev').click();
  await expect(title).toHaveText('Neon Dreams');

  const play = page.locator('#btn-play');
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Resume playback');
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await checkpoint(page, 'player-playback-paused');

  const heart = page.getByRole('button', { name: 'Like' });
  await heart.click();
  await expect(heart).toHaveText('♥');
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await checkpoint(page, 'player-track-liked');

  const filter = page.getByLabel('Filter queue');
  await filter.fill('synthwave');
  await expect(page.locator('.queue-item')).toHaveCount(2);
  await filter.fill('no such track');
  await expect(page.locator('.queue-item')).toHaveCount(0);
  await expect(page.locator('#queue-empty')).toBeVisible();
  await checkpoint(page, 'player-filter-empty-state');
  await filter.fill('');
  await page.getByRole('button', { name: 'Play Retrograde' }).click();
  await expect(title).toHaveText('Retrograde');
  await expect(page.locator('#time-total')).toHaveText('5:01');

  await page.locator('#progress-track').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#time-elapsed')).toHaveText('0:00');
  await checkpoint(page, 'player-queue-choice-and-keyboard-seek');
});

test('a grab reflects the live player state, not the initial markup', async ({ page }) => {
  await page.locator('#btn-next').click();
  await page.getByRole('button', { name: 'Like' }).click();
  const title = await grab(page, page.locator('#track-title'));
  expect(title).toContain('Midnight Circuit');
  expect(title).toMatch(/selector: div#track-title/);
  const heart = await grab(page, page.getByRole('button', { name: 'Like' }));
  expect(heart).toContain('aria-pressed="true"');
  expect(heart).toContain('♥');
});
