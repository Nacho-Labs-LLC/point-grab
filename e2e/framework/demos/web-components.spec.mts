/** Web Components playground: a release console built from nested open shadow roots. */
import { test, expect, openApp, grab } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';

test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

const card = (page: import('@playwright/test').Page, i: number) => page.locator('forge-service-card').nth(i);

test('release: deploy locks the console, ships a version, and rolls back', async ({ page }) => {
  await expect(page.getByTestId('healthy-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Deploy search-indexer' }).click();
  await expect(card(page, 1).getByTestId('service-status')).toHaveText('deploying');
  await expect(page.getByRole('button', { name: 'Deploy checkout-api' })).toBeDisabled();
  await checkpoint(page, 'release-deploy-pending-other-buttons-locked');
  await expect(page.getByTestId('pipeline-log')).toContainText('search-indexer v1.8.1 is live', { timeout: 8000 });
  await expect(card(page, 1).getByTestId('service-version')).toHaveText('1.8.1');
  await expect(card(page, 1).getByTestId('service-status')).toHaveText('healthy');
  await expect(page.getByTestId('healthy-count')).toHaveText('3');
  await checkpoint(page, 'release-deploy-complete-new-version');

  await page.getByRole('button', { name: 'Roll back search-indexer' }).click();
  await expect(card(page, 1).getByTestId('service-version')).toHaveText('1.8.0');
  await expect(page.getByTestId('forge-toast')).toHaveText('search-indexer rolled back to v1.8.0');
  await expect(page.getByRole('button', { name: 'Roll back search-indexer' })).toBeDisabled();
  await checkpoint(page, 'release-rollback-previous-version');
});

test('new service: validation, region and a new healthy card', async ({ page }) => {
  await page.getByRole('button', { name: 'New service' }).click();
  const dialog = page.getByRole('dialog', { name: 'New service' });
  await dialog.getByLabel('Service name').fill('Bad Name');
  await dialog.getByText('Create service').click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await checkpoint(page, 'new-service-invalid-name');
  await dialog.getByLabel('Service name').fill('payments-gateway');
  await dialog.getByLabel('Region').selectOption('ap-south-1');
  await dialog.getByText('Create service').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('forge-service-card')).toHaveCount(4);
  await expect(card(page, 3).locator('.service-name')).toHaveText('payments-gateway');
  await expect(page.getByTestId('forge-toast')).toHaveText('payments-gateway created in ap-south-1');
  await checkpoint(page, 'new-service-created-in-selected-region');
  await expect(page.getByTestId('healthy-count')).toHaveText('3');
});

test('a grab three shadow roots deep reports the full custom-element ancestry', async ({ page }) => {
  const snippet = await grab(page, page.getByRole('button', { name: 'Deploy image-resizer' }));
  expect(snippet).toContain('Deploy');
  expect(snippet).toMatch(/^in ForgeButton$/m);
  expect(snippet).toMatch(/^in ForgeServiceCard$/m);
  expect(snippet).toMatch(/^in ForgeApp$/m);
});
