# Current-page region capture (Add screenshot)

## User flow

1. Scroll to the part of **this webpage** you want. Open **Actions → Add screenshot**.
2. Drag a rectangle directly over the live page, in either direction. Release to capture automatically. No file upload, pasted image, screen-sharing session, desktop application or extension is required.
3. Inspect the mandatory **Review screenshot** preview. This is a **DOM-rendered approximation**, not a browser-compositor/OS screenshot. Check the actual image and privacy warning, then add a comment.
4. **Send image + comment** explicitly submits only the selected PNG, region metadata and comment to the configured image transport. It waits for acknowledgement. Retake returns to live selection; Cancel/Escape discards unsent pixels. While sending, controls are locked because closing cannot undo a pending server write. Failures preserve the preview/comment for retry.

The earlier upload/paste implementation was **not** the user's agreed primary scope; it has been replaced, not relabeled as direct page capture. There is no upload/share requirement and no claim to capture arbitrary applications or other tabs.

## Freeze lifecycle (separate from rasterization)

Ordinary element selection remains live until the user chooses **Freeze page (F)**. Freeze preserves the current hover chain, pauses running CSS/Web Animations (including active transitions at their current position), blocks hover/focus event changes, and reverts observed DOM mutations in the body and pre-existing open shadow roots. **F** unfreezes; **Escape** exits frozen selection. It does not stop JavaScript timers, network requests, framework application state, canvas/video or inaccessible shadow-root internals. Timers/state may advance in the background; this is a visible DOM freeze, not suspension of the application.

**Add screenshot** automatically freezes the visible page for region selection and review, including Retake and retry. Cancel/Escape or completed Send releases that freeze and resumes animations that Point Grab paused; author-paused animations stay paused. Existing hover details can be inspected using keyboard F before leaving the trigger. Moving the pointer to the toolbar first can naturally dismiss a transient hover panel before capture begins; capture does not resurrect a previously closed panel. Focus-only content remains inspectable while its focus is retained; this is not a global focus-state snapshot. Accessible same-document CSS hover rules are preserved; cross-origin stylesheet rules and shadow-root hover styling are not universally preserved.

The live page being stable does **not** guarantee animation-frame-identical pixels in the reconstructed clone. Continue reviewing the mandatory preview; unsupported effects/resources still reject explicitly. The DOM freeze may temporarily revert page updates, unlike the privacy redaction which only changes the clone.

## Capture contract and limits

The adapter uses `html2canvas@1.4.1` to reconstruct the current document, excluding Point-grab nodes (`__point-grab-` IDs and their descendants), then rasterizes the selected viewport region. No framework metadata is needed. The original live DOM is not hidden or redacted for rasterization; UI exclusion and privacy redaction happen in the temporary clone. The separate visible-page freeze described above temporarily reverts observed DOM updates.

- Minimum selection: 8 × 8 **CSS pixels**. Selection is restricted to the current visible viewport; scroll before opening. Scrolling (including nested scrollers) or resizing invalidates the active drag. Pointer cancellation discards it; Escape/Cancel discards pending rendering without resurrecting a stale preview.
- `region.x/y` are **document CSS coordinates**, including page scroll offsets; `region.width/height` are CSS dimensions. `width/height` describe the **actual PNG pixels**, scaled by devicePixelRatio. These units differ intentionally. No component/source metadata is invented.
- Output: PNG ≤2 MiB, ≤8192 pixels per side, ≤16 megapixels; comment ≤10,000 characters. Large documents are cloned locally and can be slow. Only the selected crop is submitted, not the whole document.
- Editable `input`, `textarea`, `select`, `[contenteditable]` values and `[data-point-grab-private]` subtrees are hidden/cleared **in the clone only**, even for non-password/autofilled fields. Redaction is not a secret detector: other rendered text, CSS-generated content and images can contain sensitive information. Preview is always required. Captures persist with history; treat storage as sensitive.
- Native selected-text/input copy, ordinary paste, existing element Comment/Confirm & Copy and queued comments remain separate flows. Screenshot capture never reads or writes the clipboard. Image clipboard Copy is not implemented.

### Deliberately rejected intersecting content

Visible intersecting iframes (same- or cross-origin), video, canvas (including 2D/WebGL/tainted canvases), object/embed, **open shadow DOM**, cross-origin HTML images/background images (even if CORS-enabled), missing/loading images, CSS filters, backdrop filters and blend modes trigger an explicit **Cannot capture this region** error. No partial image is shown or sent. Choose another region or Cancel. This conservative policy avoids html2canvas's known silent omissions; it does not assert that all such content is fundamentally impossible with other adapters.

Closed shadow roots cannot be reliably detected from ordinary page JavaScript; they are not supported and must not be marketed as captured. Generated SVG resources, pseudo-elements, CSS counters, box shadows, unsupported CSS colors/layout features, sticky/complex transformed content, web fonts and live animations may differ or fail. The preview explicitly warns of approximation; **box shadows are not a fidelity guarantee**. Parsing/encoding failures are visible and leave selection usable. Font readiness is awaited, but font rendering is not pixel-identical across engines. Pinch zoom, nonstandard visual viewports and Firefox/Safari have not been certified. Don't use the output for pixel-perfect design diffs or security evidence.

The adapter does not bypass CORS, proxy third-party content or claim access to hidden cross-origin pixels. Browser resource loading may re-fetch normal page resources while cloning. A new page/navigation or dynamic visual mutation during capture is not an atomic compositor snapshot.

## Why this implementation

Primary documentation investigated:

- [html2canvas documentation](https://html2canvas.hertzen.com/documentation): explicitly reconstructs DOM rather than taking a real screenshot; [supported CSS](https://html2canvas.hertzen.com/features/) is finite. It offers direct viewport/window/scroll/crop/scale options and clone/ignore hooks, used here for bounded capture and privacy.
- [html-to-image](https://github.com/bubkoo/html-to-image): DOM clone → SVG foreignObject → image/canvas; more browser-native CSS rendering, but font/resource embedding, cross-origin and foreignObject/browser restrictions remain.
- [modern-screenshot](https://github.com/qq15725/modern-screenshot): MIT html-to-image fork with reusable contexts/workers; still DOM/SVG rasterization, not OS pixels, and documents unsupported counters. Its broader rendering support merits a future adapter evaluation, not an untested fidelity promise.

Only the implemented html2canvas path was executed in the actual browser fixtures/framework demos. The alternatives were documentation investigations, **not** a benchmark or support certification. html2canvas is pinned for reproducible behavior, with explicit conservative rejections and documented approximation limits rather than silently claiming universal rendering. The adapter is isolated in `packages/core/src/page-capture.ts`; selection/review/MCP remain framework-independent and replaceable.

Bundled MIT notices for html2canvas and its four transitive dependencies are in `packages/core/THIRD_PARTY_LICENSES.txt`, included in the published package and global bundle banner. Root project licensing is unchanged.

## Transport

Default `mcpWebhook: true` POSTs to `http://localhost:3456/inspect`. The updated MCP server must acknowledge `{ success: true, id: string, imageAccepted: true }`; generic legacy HTTP 200 is not success. Network timeout is 15 seconds. A timeout may occur after persistence; check history before retrying to avoid duplicates. Browser CORS/local-network restrictions still apply.

The existing envelope uses `html: '<!-- Screen Grab -->'`, `selector: 'screen-region'`, null source/component fields and `screenGrab: { mimeType: 'image/png', data: '<base64 without prefix>', width, height, region: { x, y, width, height }, comment }`. The server validates PNG signature/IHDR/base64 and metadata within a 4 MiB HTTP cap. Images persist with normal history (up to 50 captures).

`point_grab_get` returns an MCP **image content block**; recent/search return metadata/comments; capture resources include an image/png blob. Browser tests use real HTTP, file persistence and a real SDK client/server linked transport. External AI-client display and stdio packaging are not certified by those tests.

For a custom destination, disable `mcpWebhook` and register exactly one plugin with `hooks.onScreenGrab(context, snippet): Promise<void>`. Resolve only after acknowledgement; reject on failure. No `onCopySuccess` hook is fired because no clipboard copy occurred.

## Run verification

From the repository root, with `pnpm` or `npx pnpm@9.15.0`:

```sh
pnpm install --frozen-lockfile
pnpm --filter './packages/**' --workspace-concurrency=1 run build
pnpm --filter @point-grab/core test -- --maxWorkers=1
pnpm --filter @point-grab/core lint
pnpm --filter @point-grab/mcp-server test -- --maxWorkers=1
pnpm exec playwright test --config playwright.page-capture.config.ts
pnpm exec node scripts/verify-framework-matrix.mjs
pnpm exec playwright test --config examples/solid/playwright.config.ts
```

Use `AGENT_BROWSER_EXECUTABLE_PATH` for shared/matrix configs and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for dedicated Solid if not using Playwright's installed Chromium. Browser tests use one worker and ephemeral HTTP/history, never the manual-preview server. The old `playwright.screen-grab.config.ts` command aliases the new live-page suite, not upload tests.

Coverage includes known exact red/blue pixels, reverse drag, DPR2, page and nested scrolling, smooth-scroll clone regression, cancellation/tiny selection, Point-grab exclusion, editable-field pixel redaction, explicit unsupported-content rejection, comment/native copy/paste, send failure/retry, missing/legacy acknowledgement and pending-send locking. Matrix success paths compare DOM output against actual compositor screenshots with a documented tolerance, **not bit-for-bit equivalence**; exact geometry/color checks use controlled fixtures. Actual Angular blur-card and Web Components shadow-root regions are tested as **visible rejections**, not fabricated successful captures. Five other demos exercise image→comment→real HTTP→persisted MCP retrieval; seven retain normal adapter/copy/comment coverage.

CI wiring is in `.github/workflows/framework-matrix.yml`; local passes do not establish that hosted CI or other browser engines passed. Failure traces/screenshots are under `test-results/`. No push/deployment/container execution is part of this change.
