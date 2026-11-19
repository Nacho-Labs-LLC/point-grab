/** Supplemental Vue UI contracts; deliberately no framework internals or state injection. */
import { test, expect, openApp } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('cart: independently open empty drawer, contain keyboard focus, and dismiss three ways', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Open cart', exact: true });
  const cart = page.getByRole('dialog', { name: 'Your Cart', exact: true });
  const close = cart.getByRole('button', { name: 'Close cart', exact: true });
  await expect(cart).toHaveCount(0);
  await expect(page.locator('.cart-badge')).toHaveCount(0);

  await opener.click();
  await expect(cart).toBeVisible();
  await expect(cart.locator('.cart-empty')).toHaveText('Your cart is empty.');
  await expect(cart.getByTestId('cart-item')).toHaveCount(0);
  await expect(cart.getByTestId('cart-total')).toHaveCount(0);
  await expect(cart.getByRole('button', { name: 'Review demo bag' })).toHaveCount(0);
  await expect(close).toBeFocused();
  // The empty drawer has one focusable control: both directions must wrap to it.
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await checkpoint(page, 'vue-empty-cart-keyboard-focus-contained');

  await close.click();
  await expect(cart).toHaveCount(0);
  await expect(page.locator('.cart-overlay')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await checkpoint(page, 'vue-empty-cart-close-button-returns-focus');

  await opener.click();
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cart).toHaveCount(0);
  await expect(page.locator('.cart-overlay')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await checkpoint(page, 'vue-empty-cart-escape-returns-focus');

  await opener.click();
  await expect(cart).toBeVisible();
  await expect(close).toBeFocused();
  // Hit the exposed left backdrop, not the drawer layered on top of its right side.
  await page.locator('.cart-overlay').click({ position: { x: 8, y: 80 } });
  await expect(cart).toHaveCount(0);
  await expect(page.locator('.cart-overlay')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await checkpoint(page, 'vue-empty-cart-backdrop-returns-focus');
  test.info().annotations.push({ type: 'demo-complete', description: 'Empty cart opening; close, Escape and backdrop dismissal; empty-drawer Tab wrap and opener focus return.' });
});

test('options: every color updates artwork and each size has exclusive selection', async ({ page }) => {
  const artwork = page.locator('.product-image');
  await expect(artwork).toHaveAttribute('aria-label', 'Unselected Novo Crewneck illustration');
  await expect(artwork.locator('.image-color-label')).toHaveText('Choose your color');
  await expect(page.locator('.color-swatch[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.size-btn[aria-pressed="true"]')).toHaveCount(0);

  for (const [name, rgb] of [
    ['Black', 'rgb(26, 26, 26)'],
    ['Cream', 'rgb(245, 240, 232)'],
    ['Forest', 'rgb(45, 74, 62)'],
  ] as const) {
    const option = page.getByRole('button', { name, exact: true });
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.color-swatch[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.option-group').filter({ has: option }).locator('.option-value')).toHaveText(name);
    await expect(artwork).toHaveAttribute('aria-label', `${name} Novo Crewneck illustration`);
    await expect(artwork.locator('.image-color-label')).toHaveText(name);
    // Assert the rendered background, not merely the selected button or accessible label.
    await expect(artwork).toHaveCSS('background-color', rgb);
    await checkpoint(page, `vue-artwork-color-${name.toLowerCase()}`);
  }

  for (const size of ['S', 'M', 'L', 'XL']) {
    const option = page.getByRole('button', { name: size, exact: true });
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.size-btn[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.option-group').filter({ has: option }).locator('.option-value')).toHaveText(size);
    await checkpoint(page, `vue-size-selected-${size.toLowerCase()}`);
  }
  const monogram = page.getByLabel('Monogram');
  await monogram.fill('XYZ');
  await expect(page.getByTestId('artwork-monogram')).toHaveText('XYZ');
  await checkpoint(page, 'vue-artwork-monogram-visible');
  await monogram.fill('');
  await expect(page.getByTestId('artwork-monogram')).toHaveCount(0);
  await checkpoint(page, 'vue-artwork-monogram-cleared');
  test.info().annotations.push({ type: 'demo-complete', description: 'All three artwork background colors and four exclusive sizes; monogram artwork insertion and removal. Garment SVG fill itself is fixed by design.' });
});

test('cart: populated focus wrap, remove final item, and reopen the resulting empty bag', async ({ page }) => {
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: 'S', exact: true }).click();
  const add = page.getByRole('button', { name: 'Add to Cart', exact: true });
  await add.click();
  const cart = page.getByRole('dialog', { name: 'Your Cart', exact: true });
  const close = cart.getByRole('button', { name: 'Close cart', exact: true });
  const remove = cart.getByRole('button', { name: 'Remove Novo Crewneck', exact: true });
  const review = cart.getByRole('button', { name: 'Review demo bag', exact: true });
  await expect(cart).toBeVisible();
  await expect(cart.getByTestId('cart-item')).toHaveCount(1);
  await expect(cart.locator('.cart-item-meta')).toHaveText('Black · S');
  await expect(cart.locator('.cart-item-swatch')).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(cart.getByTestId('cart-total')).toHaveText('$68.00');
  await expect(page.locator('.cart-badge')).toHaveText('1');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(review).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(review).toBeFocused();
  await checkpoint(page, 'vue-populated-cart-focus-contained');

  await review.click();
  await expect(cart.getByRole('status')).toHaveText('Demo bag reviewed. No payment or order was submitted.');
  await remove.click();
  await expect(cart).toBeVisible();
  await expect(cart.getByTestId('cart-item')).toHaveCount(0);
  await expect(cart.locator('.cart-empty')).toHaveText('Your cart is empty.');
  await expect(cart.getByTestId('cart-total')).toHaveCount(0);
  await expect(review).toHaveCount(0);
  await expect(cart.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.cart-badge')).toHaveCount(0);
  await checkpoint(page, 'vue-remove-final-item-empty-cart-no-total-or-review');

  // Removal deletes the focused control; use the remaining real close button.
  await close.click();
  await expect(cart).toHaveCount(0);
  await expect(add).toBeFocused();
  await page.getByRole('button', { name: 'Open cart', exact: true }).click();
  await expect(cart.locator('.cart-empty')).toHaveText('Your cart is empty.');
  await expect(cart.getByTestId('cart-item')).toHaveCount(0);
  await checkpoint(page, 'vue-reopened-cart-stays-empty-after-final-removal');
  test.info().annotations.push({ type: 'demo-complete', description: 'Single-item cart and swatch, populated keyboard focus wrap, review then last-item removal, empty reopen and add-button focus return. No persistence or checkout claim.' });
});
