const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const FRAMEWORKS = ['vanilla', 'react', 'vue', 'angular', 'svelte', 'web-components', 'solid'];
const REVIEW_SUITES = [
  { name: 'site', config: 'playwright.config.ts' },
  ...FRAMEWORKS.map(framework => ({ name: `framework-${framework}`, config: 'playwright.framework-matrix.config.ts', framework })),
  { name: 'page-capture', config: 'playwright.page-capture.config.ts' },
  { name: 'freeze', config: 'playwright.freeze.config.ts' },
  { name: 'solid-storefront', config: 'examples/solid/playwright.config.ts' },
];

// One source of truth for both Playwright cleanup roots and review-path protection.
function runnerOutputDir(suite, env = process.env) {
  if (suite === 'solid-storefront') return resolve(root, 'examples/solid', env.SOLID_TEST_OUTPUT ?? '../../test-results/solid-demo');
  if (suite.startsWith('framework-')) return resolve(root, 'test-results/framework-matrix', suite.slice('framework-'.length));
  return resolve(root, 'test-results', suite);
}
module.exports = { FRAMEWORKS, REVIEW_SUITES, runnerOutputDir };
