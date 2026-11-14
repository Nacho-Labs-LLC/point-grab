/** Vue playground: a product page with validated options, a monogram and a cart drawer. */
import { test, expect, openApp, grab } from '../fixtures.mts';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('product: validation, monogram, cart lines and totals', async ({ page }) => {
  const add = page.getByRole('button', { name: 'Add to Cart', exact: true });
  await add.click();
  await expect(page.getByRole('alert')).toHaveText('Choose a color and size before adding to your cart.');

  await page.getByRole('button', { name: 'Cream', exact: true }).click();
  await page.getByRole('button', { name: 'L', exact: true }).click();
  const monogram = page.getByLabel('Monogram');
  await monogram.pressSequentially('ab1');
  await expect(monogram).toHaveValue('AB');
  await expect(page.getByTestId('artwork-monogram')).toHaveText('AB');
  await add.click();

  const cart = page.getByRole('dialog', { name: 'Your Cart' });
  await expect(cart).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(cart.locator('.cart-item-meta')).toHaveText('Cream · L · AB');
  await expect(cart.locator('.cart-item-price')).toHaveText('$76.00');
  await expect(cart.getByTestId('cart-total')).toHaveText('$76.00');
  await page.getByRole('button', { name: 'Close cart' }).click();

  await monogram.fill('');
  await add.click();
  await expect(cart.getByTestId('cart-item')).toHaveCount(2);
  await expect(cart.getByTestId('cart-total')).toHaveText('$144.00');
  await cart.getByRole('button', { name: 'Remove Novo Crewneck' }).first().click();
  await expect(cart.getByTestId('cart-total')).toHaveText('$68.00');
  await cart.getByRole('button', { name: 'Review demo bag' }).click();
  await expect(cart.getByRole('status')).toHaveText('Demo bag reviewed. No payment or order was submitted.');

  await page.keyboard.press('Escape');
  await expect(cart).not.toBeVisible();
  await expect(page.locator('.cart-badge')).toHaveText('1');
});

test('a grab inside the cart drawer resolves the CartItem component and file', async ({ page }) => {
  await page.getByRole('button', { name: 'Forest', exact: true }).click();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  const snippet = await grab(page, page.locator('.cart-item-meta'));
  expect(snippet).toContain('Forest · M');
  expect(snippet).toMatch(/^in CartItem at .*src\/CartItem\.vue$/m);
});
