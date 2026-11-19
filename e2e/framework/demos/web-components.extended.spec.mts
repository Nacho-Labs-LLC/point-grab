/** Source-derived Forge branches omitted by web-components.spec.mts. */
import { test, expect, openApp } from '../fixtures.mts';
import { checkpoint } from '../../checkpoint';
import type { Page } from '@playwright/test';

const service = (page: Page, name: string) => page.locator(`forge-service-card[service="${name}"]`);
const complete = () => test.info().annotations.push({ type: 'coverage', description: 'demo-complete' });
test.beforeEach(async ({ page, errors }) => { void errors; await openApp(page); });

test('new service: Cancel and backdrop discard drafts and reset form defaults', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'New service', exact: true });
  await page.getByRole('button', { name: 'New service', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Service name', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Region', { exact: true })).toHaveValue('us-east-1');
  await expect(dialog.getByRole('alert')).toBeHidden();
  await checkpoint(page, 'wc-new-service-default-form');
  await dialog.getByLabel('Service name', { exact: true }).fill('cancelled-service');
  await dialog.getByLabel('Region', { exact: true }).selectOption('eu-west-1');
  await expect(dialog.getByLabel('Service name', { exact: true })).toHaveValue('cancelled-service');
  await expect(dialog.getByLabel('Region', { exact: true })).toHaveValue('eu-west-1');
  await checkpoint(page, 'wc-cancel-service-configured-draft');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('forge-service-card')).toHaveCount(3);
  await expect(service(page, 'cancelled-service')).toHaveCount(0);
  await expect(page.getByTestId('forge-toast')).toHaveCount(0);
  await checkpoint(page, 'wc-cancel-service-no-mutation');
  await page.getByRole('button', { name: 'New service', exact: true }).click();
  await expect(dialog.getByLabel('Service name', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Region', { exact: true })).toHaveValue('us-east-1');
  await dialog.getByLabel('Service name', { exact: true }).fill('backdrop-service');
  await expect(dialog.getByLabel('Service name', { exact: true })).toHaveValue('backdrop-service');
  await checkpoint(page, 'wc-backdrop-service-reopened-draft');
  await page.locator('forge-dialog .backdrop').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('forge-service-card')).toHaveCount(3);
  await expect(service(page, 'backdrop-service')).toHaveCount(0);
  await expect(page.getByTestId('forge-toast')).toHaveCount(0);
  await checkpoint(page, 'wc-backdrop-service-no-mutation');
  complete();
});

test('new service: duplicate name preserves draft, reports error, and corrected name creates once', async ({ page }) => {
  await page.getByRole('button', { name: 'New service', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New service', exact: true });
  await dialog.getByLabel('Service name', { exact: true }).fill('checkout-api');
  await dialog.getByLabel('Region', { exact: true }).selectOption('ap-south-1');
  await expect(dialog.getByLabel('Service name', { exact: true })).toHaveValue('checkout-api');
  await expect(dialog.getByLabel('Region', { exact: true })).toHaveValue('ap-south-1');
  await checkpoint(page, 'wc-duplicate-name-submitted-region-differs');
  await dialog.getByRole('button', { name: 'Create service', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText('A service named checkout-api already exists.');
  await expect(dialog.getByLabel('Service name', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('Region', { exact: true })).toHaveValue('ap-south-1');
  await expect(page.locator('forge-service-card')).toHaveCount(3);
  await expect(service(page, 'checkout-api')).toHaveCount(1);
  await expect(service(page, 'checkout-api').getByTestId('service-version')).toHaveText('2.3.1');
  await expect(service(page, 'checkout-api').locator('.meta')).toContainText('us-east-1');
  await expect(page.getByTestId('healthy-count')).toHaveText('2');
  await expect(page.getByTestId('forge-toast')).toHaveCount(0);
  await checkpoint(page, 'wc-duplicate-error-draft-retained-original-card-unchanged');
  await dialog.getByLabel('Service name', { exact: true }).fill('checkout-api-new');
  await dialog.getByRole('button', { name: 'Create service', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('forge-service-card')).toHaveCount(4);
  await expect(service(page, 'checkout-api-new').locator('.meta')).toContainText('ap-south-1');
  await expect(page.getByTestId('forge-toast')).toHaveText('checkout-api-new created in ap-south-1');
  await checkpoint(page, 'wc-duplicate-corrected-name-created-once');
  complete();
});

test('busy release: create stays available, all cards lock, and newly created service unlocks after release', async ({ page }) => {
  // Give checkout-api rollback history first so locking that control is observable.
  await page.getByRole('button', { name: 'Deploy checkout-api', exact: true }).click();
  await expect(service(page, 'checkout-api').getByTestId('service-version')).toHaveText('2.3.2', { timeout: 8000 });
  await expect(service(page, 'checkout-api').getByTestId('service-status')).toHaveText('healthy');
  await expect(page.getByRole('button', { name: 'Roll back checkout-api', exact: true })).toBeEnabled();
  await checkpoint(page, 'wc-busy-contract-rollback-history-ready');

  await page.getByRole('button', { name: 'Deploy search-indexer', exact: true }).click();
  await expect(service(page, 'search-indexer').getByTestId('service-status')).toHaveText('deploying');
  await expect(page.getByTestId('pipeline-log')).toContainText('$ forge deploy search-indexer@1.8.1');
  for (const name of ['checkout-api', 'search-indexer', 'image-resizer']) {
    await expect(page.getByRole('button', { name: `Deploy ${name}`, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: `Roll back ${name}`, exact: true })).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: 'New service', exact: true })).toBeEnabled();
  await checkpoint(page, 'wc-busy-release-locks-deploy-and-existing-rollback-not-create', { pauseMs: 0 });

  await page.getByRole('button', { name: 'New service', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New service', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Service name', { exact: true }).fill('busy-created-service');
  await dialog.getByLabel('Region', { exact: true }).selectOption('eu-west-1');
  await expect(dialog.getByRole('button', { name: 'Create service', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  await expect(service(page, 'search-indexer').getByTestId('service-status')).toHaveText('deploying');
  await checkpoint(page, 'wc-busy-release-create-dialog-remains-interactive', { pauseMs: 0 });
  await dialog.getByRole('button', { name: 'Create service', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('forge-service-card')).toHaveCount(4);
  const created = service(page, 'busy-created-service');
  await expect(created.getByTestId('service-version')).toHaveText('0.1.0');
  await expect(created.getByTestId('service-status')).toHaveText('healthy');
  await expect(created.locator('.meta')).toContainText('eu-west-1');
  await expect(page.getByTestId('forge-toast')).toHaveText('busy-created-service created in eu-west-1');
  await expect(service(page, 'search-indexer').getByTestId('service-status')).toHaveText('deploying');
  await expect(page.getByRole('button', { name: 'Deploy busy-created-service', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Roll back busy-created-service', exact: true })).toBeDisabled();
  await expect(page.getByTestId('healthy-count')).toHaveText('3');
  await checkpoint(page, 'wc-created-during-release-new-card-is-locked', { pauseMs: 0 });

  await expect(page.getByTestId('pipeline-log')).toContainText('search-indexer v1.8.1 is live', { timeout: 8000 });
  await expect(service(page, 'search-indexer').getByTestId('service-version')).toHaveText('1.8.1');
  await expect(service(page, 'search-indexer').getByTestId('service-status')).toHaveText('healthy');
  await expect(page.getByTestId('healthy-count')).toHaveText('4');
  for (const name of ['checkout-api', 'search-indexer', 'image-resizer', 'busy-created-service']) {
    await expect(page.getByRole('button', { name: `Deploy ${name}`, exact: true })).toBeEnabled();
  }
  await expect(page.getByRole('button', { name: 'Roll back checkout-api', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Roll back search-indexer', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Roll back busy-created-service', exact: true })).toBeDisabled();
  await expect(created.getByTestId('service-version')).toHaveText('0.1.0');
  await checkpoint(page, 'wc-release-finished-all-deploy-controls-unlocked');

  await page.getByRole('button', { name: 'Deploy busy-created-service', exact: true }).click();
  await expect(created.getByTestId('service-status')).toHaveText('deploying');
  await expect(page.getByTestId('pipeline-log')).toContainText('$ forge deploy busy-created-service@0.1.1');
  await checkpoint(page, 'wc-newly-created-service-can-start-next-release');
  await expect(created.getByTestId('service-version')).toHaveText('0.1.1', { timeout: 8000 });
  await expect(created.getByTestId('service-status')).toHaveText('healthy');
  await expect(page.getByRole('button', { name: 'Roll back busy-created-service', exact: true })).toBeEnabled();
  await checkpoint(page, 'wc-newly-created-service-release-complete');
  complete();
});
