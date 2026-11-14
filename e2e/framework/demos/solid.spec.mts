/** Solid playground: a storefront with filters, saves and a bag with quantities. */
import { test, expect, openApp, grab } from '../fixtures.mts';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('store: filters, saves, bag quantities, subtotal and clear', async ({ page }) => {
  const cards = page.getByTestId('product-card');
  await page.getByRole('button', { name: 'Ceramics', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Pebble vase');
  await page.getByRole('button', { name: 'All objects', exact: true }).click();
  await page.getByLabel('Search objects').fill('tote');
  await expect(cards).toHaveCount(1);
  await page.getByLabel('Search objects').fill('');

  await page.getByRole('button', { name: 'Save Arc lamp' }).click();
  await page.getByRole('button', { name: '♡ Saved only' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Arc lamp');
  await page.getByRole('button', { name: '♡ Saved only' }).click();
  await expect(cards).toHaveCount(3);

  await page.getByRole('button', { name: 'Add Arc lamp to bag', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Arc lamp quantity' }).click();
  await page.getByRole('button', { name: 'Add Everyday tote to bag', exact: true }).click();
  await expect(page.getByLabel('Arc lamp quantity', { exact: true })).toHaveText('2');
  await expect(page.getByTestId('bag-count')).toHaveText('3');
  await expect(page.getByTestId('bag-total')).toHaveText('$206');
  await page.getByRole('button', { name: 'Decrease Everyday tote quantity' }).click();
  await expect(page.getByTestId('bag-total')).toHaveText('$178');
  await page.getByRole('button', { name: 'Clear bag' }).click();
  await expect(page.getByText('Your bag is a blank canvas.')).toBeVisible();
});

test('a grab of a bag line resolves BagPanel in App.tsx with the live quantity', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Pebble vase to bag', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Pebble vase quantity' }).click();
  const snippet = await grab(page, page.getByTestId('bag-total'));
  expect(snippet).toContain('$84');
  expect(snippet).toMatch(/^in BagPanel at src\/App\.tsx:\d+:\d+$/m);
});
