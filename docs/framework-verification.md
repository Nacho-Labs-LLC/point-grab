# Cross-framework browser verification

## Latest verified checkpoint — 2026-11-14

`pnpm run test:e2e` (the CI and npm-publish gate, `scripts/test-e2e.mjs`) runs every browser suite in sequence. All passed, 170 tests:

| Suite | Config | Result |
|---|---|---|
| Site live demo | `playwright.config.ts` | 1/1 |
| Seven-framework matrix (contract + demo specs) | `playwright.framework-matrix.config.ts` via `scripts/verify-framework-matrix.mjs` | 121/121 |
| Page capture | `playwright.page-capture.config.ts` | 20/20 |
| Screen Grab UI | `playwright.screen-grab.config.ts` | 20/20 |
| Freeze lifecycle | `playwright.freeze.config.ts` | 4/4 |
| Solid storefront | `examples/solid/playwright.config.ts` | 4/4 |

The matrix runs two spec files against each real demo, one server and one worker at a time:

- **`e2e/framework/contract.spec.mts`**: 15 feature journeys shared by all seven demos. They cover arrival (toolbar, guide, MCP status online/offline), hold-to-grab with adapter context persisted to MCP and history re-copy/clear, selection mode with Escape, Copy HTML/Styles, comment batches, a queued comment surviving a cancelled screenshot, Freeze (hover and keyboard focus, reduced motion), Freeze → screenshot, the screenshot send/retry/MCP-image round trip, input redaction, native copy, toolbar controls and phone width. Per-demo selectors and expected adapter metadata live in `e2e/framework/profiles.mts`.
- **`e2e/framework/demos/<framework>.spec.mts`**: 2–3 tests that drive each playground's own workflow end to end and check that a grab captures *live* state with the right adapter context (React `Post`, Vue `CartItem`, Svelte `App`, Angular `TaskDrawerComponent`, Solid `BagPanel`, Web Components ancestry three shadow roots deep).

Unit tests: 154 across all eight packages. The legacy `e2e/<framework>.spec.ts` files and `e2e/framework-matrix.spec.mts` were retired; the suites above supersede them. Every suite writes to its own `test-results/<suite>` folder, so a later suite never wipes an earlier one's reports. `node scripts/summarize-matrix.mjs` prints a compact matrix summary.

Everything below is historical.

## Verified checkpoint — 2026-11-10

Fresh execution in `native-remote-dev`, as `dev`, against the canonical `/workspace/point-grab` working tree on `feat/demo-parity-freeze`. These results supersede the historical 18-pass/3-fail freeze matrix and earlier 14-test matrix.

- **Seven-framework matrix: 21 passed, 0 unexpected, 0 flaky, 0 skipped.** All seven individual JSON reports and the full `summary.json` were parsed and checked together.
- **Shared freeze lifecycle: 4/4 passed.**
- **Shared page capture: 19/19 passed.**
- **Dedicated Solid: 4/4 passed.**
- Workspace package tests: core **101**, MCP **7**, React adapter **4**, Solid adapter **17** passed. These are unit/VM/integration evidence, not additional browser journeys.
- Sequential workspace `test`, `lint`, and `build` commands passed. Production builds include all eight packages, all seven demos, and the site. Build warnings remain: Angular's html2canvas CommonJS optimization warning, React's >500 kB chunk warning, and Svelte's default-config notice.
- `git diff --check` passed. Existing dirty/untracked work remains preserved; nothing was committed or published.

### Browser provisioning in the migrated environment

Node v22.23.4, pnpm 9.15.0, Playwright 1.63.0, and Chrome for Testing **153.0.8010.12** (Playwright revision 1243). The new container initially had no browser or required Chromium shared libraries. The normal Playwright browser install failed resolving `cdn.playwright.dev` (`EAI_AGAIN`). The matching official archive was downloaded from `https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/linux64/chrome-linux64.zip` instead, extracted beneath `/home/dev/.cache/point-grab-browser`, and made executable. Playwright's `install-deps chromium` installed the runtime dependencies successfully.

Browser path: `/home/dev/.cache/point-grab-browser/chrome-linux64/chrome`. This is local test infrastructure, not a product dependency. System libraries were installed into the running dev container, not baked into its image; recreating that container may require reprovisioning them. No Hermes restart or container recreation was performed.

## Reproduce

For a fresh environment:

```sh
pnpm install --frozen-lockfile
pnpm --filter './packages/**' --workspace-concurrency=1 run build
pnpm exec playwright install --with-deps chromium
pnpm exec node scripts/verify-framework-matrix.mjs
pnpm exec playwright test --config=playwright.freeze.config.ts
pnpm exec playwright test --config=playwright.page-capture.config.ts
pnpm exec playwright test --config=examples/solid/playwright.config.ts
```

The fresh local verification used the existing migrated dependency installation, not a new frozen install. After provisioning the browser, the exact browser commands above ran with:

```sh
export AGENT_BROWSER_EXECUTABLE_PATH=/home/dev/.cache/point-grab-browser/chrome-linux64/chrome
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$AGENT_BROWSER_EXECUTABLE_PATH"
export TMPDIR=/home/dev/.cache/point-grab-browser
```

Static/unit/production gates ran as:

```sh
pnpm -r --workspace-concurrency=1 run test
pnpm -r --workspace-concurrency=1 run lint
pnpm -r --workspace-concurrency=1 run build
```

Select individual demos with `pnpm exec node scripts/verify-framework-matrix.mjs vue solid`. Rebuild packages after source changes: the runner checks required build artifacts but does not rebuild them. **Subset runs overwrite `summary.json`; inspect its framework list before claiming a full matrix.**

## Actual-demo contract and current results

The matrix starts one real framework server at a time on strict `127.0.0.1:5188`, with one browser worker, no retries and one Angular build worker. It never uses manual previews. Demo transport is routed to a **real ephemeral HTTP webhook**, disposable file history, and actual SDK MCP retrieval over linked in-memory SDK transports. Success responses and image payloads are not fabricated. Browser page errors fail tests. This verifies browser→HTTP→disk→MCP content, not stdio packaging or external AI-client display.

Each of Vanilla, React, Vue, Angular, Svelte, Web Components, and Solid passed:

1. Real animated demo motion; keyboard F freeze preserving visible hover detail after pointer movement; stable computed transforms; Escape/resume; focus-triggered detail with keyboard freeze; screenshot-selection Cancel **and Escape** restoring motion; reduced motion after reload.
2. Real framework interaction; native selected-text copy; actual element pick and POST acknowledgement correlated with persisted ID/context; existing queued comment surviving screenshot Cancel and Confirm & Copy. Nearest components are anchored (React `Post`, Vue `App`, Angular `PostCardComponent`, Svelte `NoteCard`, Web Components `ForgeCard`, Solid `ProductCard`). Solid source context identifies `App.tsx`.

Five frameworks—Vanilla, React, Vue, Svelte, Solid—also passed the expanded real-page screenshot journey: with `mediaDevices` absent, drag on the current webpage, genuine DOM-rendered preview, stable real demo motion throughout preview→Retake→selection→preview, Escape/resume, recapture, comment, injected HTTP 503 preserving preview/comment/freeze, retry through the real listener, exact persisted preview bytes/dimensions/comment and MCP image, unchanged clipboard, and resumed motion after successful send.

Angular's selected demo region uses an unsupported filter. Web Components' selected region crosses shadow DOM. Both passed **visible rejection with no preview or image send**. Those two cases are renderer-boundary checks, not screenshot successes, and do not exercise preview/Retake/send on those rejected regions. Angular plain DOM is not intrinsically unsupported. Open-shadow freeze support is separate from rasterizer support. Angular/Web Components do not claim source-file fidelity.

The 21 tests therefore comprise seven motion/freeze journeys, seven normal interaction/adapter/comment journeys, five screenshot-success journeys, and two intentional capture-rejection journeys—not seven universal screenshot successes.

### Measured screenshot comparison

Test-only real browser screenshots provide compositor references; product code never uses Playwright/DevTools screenshots. DOM reconstruction is approximate. Thresholds remain mean RGB absolute error <25/255 and >70% pixels within 20/channel. Latest mean error / close fraction:

- Vanilla: 0.268 / 0.9971
- React: 8.962 / 0.9089
- Vue: 6.243 / 0.9343
- Svelte: 5.639 / 0.9640
- Solid: 3.844 / 0.9592

These samples do not guarantee fidelity for other regions. Exact geometry/color/DPR are separately asserted by controlled live-page fixtures.

## Shared engine and dedicated Solid checks

The **4 freeze browser tests** exercise built shared core: screenshot selection→stable live DOM/animation→preview→Retake→Escape/resume; nested open-shadow animations and DOM mutation freezing, author-paused/cancelled animations and disposal; an already-running CSS transition and WAAPI paused at their current timeline positions; initial hover preservation and Escape. Historical red-before-fix observations belong to the earlier implementation sessions; this session reran the current implementation and strengthened matrix coverage without changing product behavior.

The **19 page-capture browser tests** cover real red/blue pixels, reverse drag, instruction-overlay exclusion, page/nested/smooth scrolling, DPR2, Escape/pointercancel/tiny drag/Retake, editable-field pixel redaction without modifying live inputs, iframe/video/canvas/cross-origin image/filter/shadow/broken-resource failures, real send/retry, pending acknowledgement control locking, legacy/missing transport rejection, and native text/input copy/comment paste. The legacy `playwright.screen-grab.config.ts` command aliases this suite, not 19 additional tests.

The **4 dedicated Solid browser journeys** cover catalog/filter/saved/bag/quantity/total/Show/For/native inputs, actual Solid source context/comments, live-page preview, and 390px responsive reachability.

## Evidence, CI, and limitations

`test-results/framework-matrix/summary.json` contains exactly all seven frameworks; individual `<framework>.json` reports contain 21 expected and zero unexpected/flaky/skipped tests in the latest run. Review screenshots: `test-results/framework-matrix/<framework>-page-preview.png`; shared review: `test-results/page-capture/review.png`. Generated evidence is local and ignored, not committed test data.

`.github/workflows/framework-matrix.yml` includes frozen installation, sequential package builds, Chromium provisioning, matrix, shared page capture, shared freeze, and dedicated Solid, plus failure evidence upload. **This dirty working-tree CI configuration and its untracked suites are not a published gate yet. Hosted GitHub CI has not been run in this session.**

No claim is made for Firefox/Safari, arbitrary desktop/OS screenshots, native browser sharing permissions, stdio/client display integration, deployment, or Docker image rebuild reproducibility. Freeze does not suspend application JS state/timers, property-only changes, canvas/video, closed roots, or inaccessible cross-origin stylesheets. Current shadow-motion/DOM fixtures do not certify every shadow-hover selector or focus-transfer behavior. Renderer and privacy limits remain in [current-page capture contract](screen-grab.md).
