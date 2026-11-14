import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
let server: Server, url: string;
test.beforeAll(async () => {
  const bundle = await readFile('packages/core/dist/index.global.js');
  server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><style>@keyframes drift{to{transform:translateX(100px)}}#moving{animation:drift 2s linear infinite alternate;width:80px;height:30px;background:coral}.hint{display:none}#trigger:hover .hint,#trigger:focus-within .hint{display:block}@media(prefers-reduced-motion:reduce){#moving{animation:none}}</style><div id="moving">Moving</div><button id="trigger">Details<span class="hint">Inspect this transient detail</span></button><div id="ticks">0</div><script src="/bundle.js"></script><script>window.pg=PointGrab.init({devOnly:false});setInterval(()=>{ticks.textContent=String(Number(ticks.textContent)+1)},50)</script>`);
  }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); url = `http://127.0.0.1:${(server.address() as any).port}`;
});
test.beforeEach(async ({ page }) => { const errors: string[] = []; (page as any).__errors = errors; page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(async ({ page }) => expect((page as any).__errors).toEqual([]));
test.afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });
test('screenshot selection freezes live animation and DOM, then cancel resumes', async ({ page }) => {
  await page.goto(url);
  const sample = () => page.locator('#moving').evaluate(el => getComputedStyle(el).transform);
  const first = await sample(); await page.waitForTimeout(160); expect(await sample()).not.toBe(first);
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add screenshot', { exact: true }).click();
  await page.waitForTimeout(80); const frozen = await sample(), ticks = await page.locator('#ticks').innerText();
  await page.waitForTimeout(220); expect(await sample()).toBe(frozen); expect(await page.locator('#ticks').innerText()).toBe(ticks);
  await page.mouse.move(300, 200); await page.mouse.down(); await page.mouse.move(500, 300); await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Review screenshot' })).toBeVisible();
  await page.waitForTimeout(160); expect(await sample()).toBe(frozen);
  await page.getByRole('button', { name: 'Retake', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Select current page region', exact: true })).toBeVisible();
  expect(await sample()).toBe(frozen);
  await page.keyboard.press('Escape'); await page.waitForTimeout(160); expect(await sample()).not.toBe(frozen);
});
test('nested open-shadow CSS animations and DOM freeze, preserve author pauses and cancellation, and clean up on exit', async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => {
    document.querySelector('#moving')!.remove();
    const host = document.createElement('section'); host.id = 'shadow-host'; document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const motion = '<style>@keyframes drift{to{transform:translateX(100px)}}.motion{animation:drift 2s linear infinite alternate;width:40px;height:20px}#author{animation-play-state:paused}</style><div class="motion">Moving</div>';
    root.innerHTML = motion + '<span id="shadow-tick">0</span><div id="nested"></div>';
    const nested = root.querySelector('#nested')!.attachShadow({ mode: 'open' });
    nested.innerHTML = motion + '<div class="motion" id="author">Paused</div><div class="motion" id="cancelled">Cancel</div>';
    Object.assign(window, { shadowAnimations: [root.querySelector('.motion')!.getAnimations()[0], nested.querySelector('.motion')!.getAnimations()[0]], author: nested.querySelector('#author')!.getAnimations()[0], cancelled: nested.querySelector('#cancelled')!.getAnimations()[0] });
    setInterval(() => { const el = root.querySelector('#shadow-tick')!; el.textContent = String(Number(el.textContent) + 1); }, 50);
  });
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  const sample = () => page.evaluate(() => (window as any).shadowAnimations.map((a: Animation) => a.currentTime));
  const first = await sample(); await page.waitForTimeout(100); expect(await sample()).not.toEqual(first);
  const target = page.locator('#shadow-host #shadow-tick');
  const assertFrozen = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const frozen = await sample(), ticks = await target.innerText();
    await page.waitForTimeout(180); expect(await sample()).toEqual(frozen); expect(await target.innerText()).toBe(ticks);
    expect(await page.evaluate(() => (window as any).author.playState)).toBe('paused');
    return frozen;
  };
  await page.keyboard.press('Control+c'); await page.keyboard.press('f');
  const frozen = await assertFrozen();
  await page.evaluate(() => (window as any).cancelled.cancel());
  await page.keyboard.press('Escape'); await page.waitForTimeout(180); expect(await sample()).not.toEqual(frozen);
  expect(await page.evaluate(() => [(window as any).author.playState, (window as any).cancelled.playState])).toEqual(['paused', 'idle']);
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByText('Add screenshot', { exact: true }).click();
  const captureFrozen = await assertFrozen();
  await page.keyboard.press('Escape'); await page.waitForTimeout(100); expect(await sample()).not.toEqual(captureFrozen);
  await page.keyboard.press('f'); await assertFrozen();
  await page.evaluate(() => (window as any).pg.dispose());
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).shadowAnimations.map((a: Animation) => a.playState))).toEqual(['running', 'running']);
  expect(await page.evaluate(() => (window as any).author.playState)).toBe('paused');
  await expect(page.locator('[id^="__point-grab-freeze"]')).toHaveCount(0);
});

test('running transition and WAAPI stay at their current position, preserve author-paused animation, and resume after F toggle', async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('#moving')!;
    el.style.animation = 'none'; el.style.transition = 'transform 3s linear'; el.getBoundingClientRect(); el.style.transform = 'translateX(180px)';
    const waapi = document.querySelector('#trigger')!.animate([{ opacity: 1 }, { opacity: .4 }], { duration: 3000, iterations: Infinity });
    const paused = document.querySelector('#ticks')!.animate([{ opacity: 1 }, { opacity: .3 }], { duration: 1000 }); paused.pause();
    Object.assign(window, { waapi, paused });
  });
  await page.waitForTimeout(180);
  await page.keyboard.press('Control+c'); await page.keyboard.press('f');
  await page.waitForTimeout(80);
  const sample = () => page.evaluate(() => ({ transform: getComputedStyle(document.querySelector('#moving')!).transform, time: (window as any).waapi.currentTime }));
  const frozen = await sample(); await page.waitForTimeout(220); expect(await sample()).toEqual(frozen);
  await page.keyboard.press('f'); await page.waitForTimeout(180); expect(await sample()).not.toEqual(frozen);
  expect(await page.evaluate(() => (window as any).paused.playState)).toBe('paused');
});

test('explicit Freeze preserves hover detail, CSS motion, and resumes on Escape', async ({ page }) => {
  await page.goto(url); await page.locator('#trigger').hover(); await expect(page.locator('.hint')).toBeVisible();
  await page.keyboard.down('Control'); await page.keyboard.down('c'); await page.keyboard.press('f');
  await page.keyboard.up('c'); await page.keyboard.up('Control');
  await page.mouse.move(800, 500); await expect(page.locator('.hint')).toBeVisible();
  const sample = () => page.locator('#moving').evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(80); const frozen = await sample(); await page.waitForTimeout(160); expect(await sample()).toBe(frozen);
  await page.keyboard.press('Escape'); await expect(page.locator('.hint')).not.toBeVisible(); await page.waitForTimeout(160); expect(await sample()).not.toBe(frozen);
});
