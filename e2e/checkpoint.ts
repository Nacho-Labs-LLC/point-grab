import { test, expect, type Page } from '@playwright/test';

/** Review-only evidence: real rendered UI, never injected product state. */
export async function checkpoint(page: Page, name: string, options: { pauseMs?: number } = {}) {
  if (!process.env.POINT_GRAB_EVIDENCE_DIR) return;
  await test.step(`Visual checkpoint: ${name}`, async () => {
    // A visible panel can still be entering/leaving. Wait only for finite tool
    // or dialog/menu transitions; never disable or await live demo animations.
    if (options.pauseMs !== 0) {
      await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity
          && target instanceof Element
          // The inspection rectangle continuously follows live page geometry;
          // its short transitions are not entering/leaving interactive panels.
          && target.closest('#__point-grab-toolbar__, #__point-grab-toast__, [role="dialog"], [role="menu"]');
      }).length), { timeout: 2500, message: 'tool panels have settled before visual capture' }).toBe(0);
    }
    // Capture the assertion-gated state first: delaying before a screenshot can
    // mislabel a short-lived Updating/deploying state after it has already ended.
    await test.info().attach(name, { body: await page.screenshot(), contentType: 'image/png' });
    // Readability pauses are opt-in recording only; use zero for time-bound phases.
    await page.waitForTimeout(options.pauseMs ?? 450);
  });
}
