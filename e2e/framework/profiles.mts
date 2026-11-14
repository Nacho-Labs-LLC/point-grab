import { expect, type Locator, type Page } from '@playwright/test';

export type Framework = 'vanilla' | 'react' | 'vue' | 'angular' | 'svelte' | 'web-components' | 'solid';

/**
 * How the shared feature contract drives each real demo. Every selector targets the
 * demo's own rendered UI; nothing is injected by the tests.
 */
export interface Profile {
  /** Wait until the app has rendered. */
  ready(page: Page): Promise<void>;
  /** Perform a real state change in the app, assert it, and return an element to grab. */
  interact(page: Page): Promise<Locator>;
  /** The primary grab target (present without interaction). */
  target(page: Page): Locator;
  /** A different element, for multi-element comment batches. */
  second(page: Page): Locator;
  /** Adapter metadata expected for `target`. */
  grab: { component: RegExp | null; snippet: RegExp[] };
  /** A visible text field, opening UI if needed. Typing into it must not reflow the page. */
  input(page: Page): Promise<Locator>;
  /** Values to type: [secret, native-copy]. Defaults suit free-text fields. */
  inputValues?: [string, string];
  /** An element to drag a screenshot region over. */
  shot(page: Page): Locator;
}

const byTestId = (page: Page, id: string) => page.getByTestId(id).first();

export const profiles: Record<Framework, Profile> = {
  vanilla: {
    ready: (page) => expect(page.locator('#track-title')).toHaveText('Neon Dreams'),
    async interact(page) {
      await page.locator('#btn-next').click();
      await expect(page.locator('#track-title')).toHaveText('Midnight Circuit');
      return page.locator('#track-title');
    },
    target: (page) => page.locator('#track-title'),
    second: (page) => page.locator('.queue-item').nth(2),
    grab: { component: null, snippet: [/selector: div#track-title/] },
    input: async (page) => page.getByLabel('Filter queue'),
    shot: (page) => page.locator('.now-playing'),
  },

  react: {
    ready: (page) => expect(page.locator('.post-text').first()).toBeVisible(),
    async interact(page) {
      await page.locator('.like-btn').first().click();
      await expect(page.locator('.like-btn').first()).toContainText('49');
      return page.locator('.post-text').first();
    },
    target: (page) => page.locator('.post-text').first(),
    second: (page) => page.locator('.post-text').nth(1),
    // Exact source line through the dev server's source map, not the transformed module.
    grab: { component: /^Post$/, snippet: [/^at src\/App\.jsx:112:9$/m, /^in Post at src\/App\.jsx:\d+:\d+$/m, /^in App/m] },
    input: async (page) => page.getByLabel('What are you building?'),
    shot: (page) => page.locator('article.post').first(),
  },

  vue: {
    ready: (page) => expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible(),
    async interact(page) {
      await page.getByRole('button', { name: 'Forest', exact: true }).click();
      await page.getByRole('button', { name: 'M', exact: true }).click();
      await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
      await expect(page.locator('.cart-item-meta')).toHaveText('Forest · M');
      await page.getByRole('button', { name: 'Close cart' }).click();
      return page.locator('.color-swatch').first();
    },
    target: (page) => page.locator('.color-swatch').first(),
    second: (page) => page.locator('.size-btn').first(),
    grab: { component: /^ColorPicker$/, snippet: [/^in ColorPicker at .*src\/ColorPicker\.vue$/m, /^in App at .*src\/App\.vue$/m] },
    input: async (page) => page.getByLabel('Monogram'),
    inputValues: ['XQZ', 'ABC'], // monogram: up to three letters
    shot: (page) => page.locator('.product-image'),
  },

  svelte: {
    ready: (page) => expect(page.locator('.note-title-preview').first()).toBeVisible(),
    async interact(page) {
      await page.getByRole('button', { name: '+ New Note', exact: true }).click();
      await page.getByPlaceholder('Note title').fill('Framework contract note');
      await expect(page.locator('.note-title-preview').first()).toHaveText('Framework contract note');
      await page.getByPlaceholder('Note title').blur();
      return page.locator('.note-title-preview').first();
    },
    target: (page) => page.locator('.note-title-preview').first(),
    second: (page) => page.locator('.word-count'),
    grab: { component: /^NoteCard$/, snippet: [/^in NoteCard at src\/NoteCard\.svelte:5:2$/m, /^in App at src\/App\.svelte:\d+:\d+$/m] },
    input: async (page) => page.getByPlaceholder('Find a thought…'),
    shot: (page) => page.locator('.editor-panel'),
  },

  'web-components': {
    ready: (page) => expect(page.locator('forge-service-card')).toHaveCount(3),
    async interact(page) {
      await page.getByRole('button', { name: 'Deploy checkout-api' }).click();
      await expect(byTestId(page, 'pipeline-log')).toContainText('checkout-api v2.3.2 is live', { timeout: 8000 });
      await expect(page.locator('forge-service-card').first().getByTestId('service-version')).toHaveText('2.3.2');
      return page.locator('forge-service-card').first().locator('.service-name');
    },
    target: (page) => page.locator('forge-service-card').first().locator('.service-name'),
    second: (page) => page.locator('forge-service-card').nth(1).locator('.service-name'),
    // Custom-element ancestry across nested shadow roots; no source metadata exists for WC.
    grab: { component: /^ForgeServiceCard$/, snippet: [/^in ForgeServiceCard$/m, /^in ForgeApp$/m] },
    async input(page) {
      await page.getByRole('button', { name: 'New service' }).click();
      return page.getByLabel('Service name');
    },
    shot: (page) => page.locator('forge-service-card').first(),
  },

  angular: {
    ready: (page) => expect(page.locator('app-task-card')).toHaveCount(5),
    async interact(page) {
      await page.getByRole('button', { name: 'Move Apple Pay on the payment step to In progress' }).click();
      await expect(page.locator('app-board-column').nth(0).getByTestId('column-count')).toHaveText('1');
      await expect(page.locator('app-board-column').nth(1).getByTestId('column-count')).toHaveText('3');
      return page.locator('app-task-card .task-title').first();
    },
    target: (page) => page.locator('app-task-card .task-title').first(),
    second: (page) => page.getByTestId('sprint-stats'),
    grab: { component: /^TaskCardComponent$/, snippet: [/^in TaskCardComponent$/m, /^in BoardColumnComponent$/m, /^in App$/m] },
    async input(page) {
      // The search box filters the board (and reflows the page), so use the dialog's field.
      await page.getByRole('button', { name: '+ New task' }).click();
      return page.getByLabel('New task title');
    },
    shot: (page) => page.locator('app-board-column').first(),
  },

  solid: {
    ready: (page) => expect(page.getByTestId('product-card')).toHaveCount(3),
    async interact(page) {
      await page.getByRole('button', { name: 'Add Arc lamp to bag', exact: true }).click();
      await expect(page.getByTestId('bag-count')).toHaveText('1');
      return page.locator('.product-card h3').first();
    },
    target: (page) => page.locator('.product-card h3').first(),
    second: (page) => page.locator('.product-card h3').nth(1),
    grab: { component: /^ProductCard$/, snippet: [/^at src\/App\.tsx:\d+:\d+$/m, /^in ProductCard at src\/App\.tsx:\d+:\d+$/m] },
    input: async (page) => page.getByLabel('Gift note'),
    shot: (page) => page.locator('.product-grid'),
  },
};
