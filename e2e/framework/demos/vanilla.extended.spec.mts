/** Supplement the original player journey using only the demo's rendered controls. */
import { test, expect, openApp, grab } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('player: volume, shuffle, repeat, seeking, resume and per-track likes', async ({ page }) => {
  test.setTimeout(90_000);
  const play = page.locator('#btn-play');
  const title = page.locator('#track-title');
  const seek = page.getByRole('slider', { name: 'Track position' });
  const heart = page.getByRole('button', { name: 'Like', exact: true });
  const shuffle = page.locator('#btn-shuffle');
  const repeat = page.locator('#btn-repeat');
  const volume = page.locator('#btn-volume');
  const popover = page.locator('#volume-popover');
  const slider = page.getByRole('slider', { name: 'Demo volume' });

  // The demo simulates progress; it has no audio element or real audio output.
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Resume playback');
  await expect(popover).toBeHidden();
  await expect(volume).toHaveAttribute('aria-expanded', 'false');
  await volume.click();
  await expect(popover).toBeVisible();
  await expect(volume).toHaveAttribute('aria-expanded', 'true');
  await expect(slider).toHaveValue('75');
  await checkpoint(page, 'player-volume-open-default');
  await slider.focus();
  await slider.press('End');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue('99');
  await expect(page.locator('#volume-pct')).toHaveText('99%');
  await expect(popover).toBeVisible();
  await checkpoint(page, 'player-volume-changed-inside-popover');
  await volume.click();
  await expect(popover).toBeHidden();
  await expect(volume).toHaveAttribute('aria-expanded', 'false');
  await checkpoint(page, 'player-volume-button-closed');
  await volume.click();
  await expect(popover).toBeVisible();
  await expect(slider).toHaveValue('99');
  await checkpoint(page, 'player-volume-reopened-value-retained');
  await title.click();
  await expect(popover).toBeHidden();
  await expect(volume).toHaveAttribute('aria-expanded', 'false');
  await checkpoint(page, 'player-volume-outside-dismissed');

  await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
  await checkpoint(page, 'player-shuffle-enabled');
  await page.locator('#btn-next').click();
  // Do not seed Math.random: every supported shuffle outcome must be a different track.
  await expect(title).not.toHaveText('Neon Dreams');
  const shuffledTitle = await title.innerText();
  expect(['Midnight Circuit', 'Glass City', 'Retrograde', 'Pulse & Static']).toContain(shuffledTitle);
  await expect(page.getByRole('button', { name: `Play ${shuffledTitle}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await checkpoint(page, 'player-shuffle-next-different-track');
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Play Neon Dreams', exact: true }).click();
  await page.locator('#btn-next').click();
  await expect(title).toHaveText('Midnight Circuit');
  await expect(page.locator('#time-total')).toHaveText('4:12');
  await checkpoint(page, 'player-shuffle-disabled-sequential-next');

  await page.getByRole('button', { name: 'Play Neon Dreams', exact: true }).click();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect(heart).toHaveText('♥');
  await checkpoint(page, 'player-neon-liked');
  await page.locator('#btn-next').click();
  await expect(title).toHaveText('Midnight Circuit');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await expect(heart).toHaveText('♡');
  await checkpoint(page, 'player-other-track-unliked');
  await page.locator('#btn-prev').click();
  await expect(title).toHaveText('Neon Dreams');
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await checkpoint(page, 'player-liked-track-state-restored');
  await heart.click();
  await expect(heart).toHaveText('♡');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#btn-next').click();
  await page.locator('#btn-prev').click();
  await expect(title).toHaveText('Neon Dreams');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await checkpoint(page, 'player-unlike-retained-after-track-switch');

  await seek.scrollIntoViewIfNeeded();
  const bounds = await seek.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await expect(seek).toHaveAttribute('aria-valuenow', '50');
  // Fractional CSS coordinates may land just below the exact half-second boundary.
  await expect(page.locator('#time-elapsed')).toHaveText(/^1:5[34]$/);
  await checkpoint(page, 'player-pointer-seek-halfway');
  // Home gives an exact baseline even if the browser rounds pointer coordinates.
  await seek.focus();
  await seek.press('Home');
  await seek.press('ArrowRight');
  await expect(seek).toHaveAttribute('aria-valuenow', '5');
  await expect(page.locator('#time-elapsed')).toHaveText('0:11');
  await checkpoint(page, 'player-keyboard-seek-right');
  await seek.press('ArrowLeft');
  await expect(seek).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('#time-elapsed')).toHaveText('0:00');
  await checkpoint(page, 'player-keyboard-seek-left');
  await seek.press('End');
  await expect(seek).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('#time-elapsed')).toHaveText('3:47');
  await checkpoint(page, 'player-keyboard-seek-end-paused');
  // The picker deliberately resolves the deepest actual element. At 100%, the
  // slider center is its fill child, not the parent slider's ARIA attributes.
  const positionGrab = await grab(page, page.locator('#progress-fill'));
  expect(positionGrab).toContain('id="progress-fill"');
  expect(positionGrab).toContain('width: 100%');
  await test.info().attach('player-end-position-grab', { body: positionGrab, contentType: 'text/plain' });

  await expect(repeat).toHaveAttribute('aria-pressed', 'false');
  await repeat.click();
  await expect(repeat).toHaveAttribute('aria-pressed', 'true');
  await checkpoint(page, 'player-repeat-enabled-at-track-end');
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Pause playback');
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await seek.getAttribute('aria-valuenow'))).toBeLessThan(10);
  await expect(title).toHaveText('Neon Dreams');
  await expect.poll(async () => Number(await seek.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  await checkpoint(page, 'player-repeat-restarts-same-track-and-progress-resumes');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await repeat.click();
  await expect(repeat).toHaveAttribute('aria-pressed', 'false');
  await seek.focus();
  await seek.press('End');
  await expect(page.locator('#time-elapsed')).toHaveText('3:47');
  await checkpoint(page, 'player-repeat-disabled-at-track-end');
  await play.click();
  await expect(title).toHaveText('Midnight Circuit');
  await expect(page.locator('#time-total')).toHaveText('4:12');
  await expect(page.getByRole('button', { name: 'Play Midnight Circuit', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await seek.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await checkpoint(page, 'player-repeat-off-auto-advances-and-keeps-playing');
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Resume playback');
  const elapsed = await page.locator('#time-elapsed').innerText();
  // Observe more than two real 200ms player ticks; a paused timer must not advance.
  await page.waitForTimeout(650);
  await expect(page.locator('#time-elapsed')).toHaveText(elapsed);
  await checkpoint(page, 'player-resumed-then-paused-final-state');
  test.info().annotations.push({ type: 'coverage', description: 'demo-complete' });
});
