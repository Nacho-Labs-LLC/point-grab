# Current-page region capture (Add screenshot)

## User flow and shortcuts

1. Activate Point Grab with **Ctrl+B on every platform**, including macOS (Control, not Command). Hold is the default; `activationMode: 'toggle'` toggles on key release. `activationKey` accepts one key plus optional modifiers, which must match exactly. Ctrl+C/Cmd+C remain normal copy with the default configuration; Ctrl+Shift+B does not match Ctrl+B. Activation in editable inputs is disabled by default (`enableInInputs: false`).
2. Scroll to the part of **this webpage** you want, then open **Actions → Add screenshot**. Drag a rectangle on the live page in either direction; release to render. No upload, paste, screen sharing, extension or desktop application is required.
3. Inspect the mandatory **Review screenshot** preview and warnings, then add a comment. This is a **DOM-rendered approximation**, not a browser-compositor/OS screenshot.
4. **Send image + comment** (or Ctrl/Cmd+Enter in the comment field) explicitly submits the selected PNG, region metadata and comment to the configured image transport and waits for acknowledgement. Retake returns to selection; Cancel/Escape discards unsent pixels. Controls lock during Send because closing cannot undo a pending server write. Failures retain the preview/comment for retry.

Capture is restricted to the current page, not other tabs or arbitrary applications. Native text/input copy, paste, element Comment/Confirm & Copy and queued comments are separate flows. Screenshot capture neither reads nor writes the clipboard; image clipboard Copy is not implemented.

## Freeze lifecycle (separate from rasterization)

Ordinary element selection stays live until **Freeze page (F)**. The single-key `freezeKey` option defaults to `'F'` and can be changed at initialization or with `setOptions`; the toolbar label follows it. It works while selecting or while the toolbar is visible, ignores editable targets and is inactive during screenshot selection/review. Press it again to unfreeze; **Escape** exits frozen selection.

Freeze preserves the current hover chain, pauses running CSS/Web Animations (including active transitions at their current position), blocks hover/focus event changes, and reverts observed DOM mutations in the body and pre-existing open shadow roots. It does not suspend JavaScript timers, network requests, framework application state, canvas/video or inaccessible shadow internals. Timers/state may advance behind the visibly frozen DOM.

**Add screenshot** automatically freezes the visible page for selection and review, including Retake and retry. Cancel/Escape or completed Send releases that freeze and resumes animations Point Grab paused; author-paused animations stay paused. Use the freeze key before leaving a hover trigger: moving to the toolbar can dismiss transient content, and capture cannot resurrect it. Focus-only content depends on retained focus. Accessible same-document CSS hover rules are preserved; cross-origin stylesheet rules and shadow-root hover styling are not universally preserved.

Stable live DOM does not guarantee animation-frame-identical pixels in the reconstructed clone. Freeze temporarily reverts live-page updates; capture redaction only changes the clone.

## Capture contract and limits

`packages/core/src/page-capture.ts` lazily loads pinned `html2canvas@1.4.1` to reconstruct the document and crop the selected viewport region. Point Grab nodes (`__point-grab-` IDs and descendants) are excluded. No framework/source metadata is invented.

- Minimum selection: **8 × 8 CSS pixels**, restricted to the visible viewport. Scroll before opening. Page/nested scrolling or resizing invalidates the active drag/render; pointer cancellation and Cancel/Escape discard pending work rather than reopening a stale preview.
- `region.x/y` are **document CSS coordinates**, including page scroll offsets; region dimensions are CSS pixels. PNG `width/height` are actual image pixels scaled by devicePixelRatio.
- Output: PNG ≤2 MiB, ≤8192 pixels per side, ≤16 megapixels; comment ≤10,000 characters. Large documents are cloned locally and may be slow. Only the selected crop is submitted, not the whole document.
- Editable `input`, `textarea`, `select`, enabled `[contenteditable]` elements and `[data-point-grab-private]` subtrees are hidden/cleared **in the clone only**, not the live page. This includes non-password/autofilled fields. Redaction is not a secret detector: rendered text, generated content, images and canvas pixels may still contain sensitive information. Review every preview; captures persist in history and storage is sensitive.

### Rendered with limitations, not blanket rejections

- **Open shadow DOM**, including nested roots and slotted content, is traversed for preflight and rendered through html2canvas's clone/flattening path. Clone redaction also applies to flattened editable/private content. This is not a promise of fidelity for every shadow layout/style.
- **Exportable 2D canvas** pixels can be captured. Preflight calls `toDataURL()` without initializing/changing the live canvas context. A canvas whose export throws (for example, tainted cross-origin content) is rejected. A blank export produces **“A WebGL or empty canvas in this region appears blank.”** WebGL fidelity is not guaranteed; this warning is based on export pixels, not reliable context-type detection.
- **CSS filters/backdrop filters** do not cause blanket rejection: the review warns that effects are shown **without the filter**. **Blend modes** warn that content is shown **unblended**. Review the approximation rather than treating it as compositor output.

### Explicit rejection and remaining caveats

Visible intersecting iframes (same- or cross-origin), video, object/embed, cross-origin HTML/background images (even CORS-enabled), missing/loading HTML images and non-exportable canvases produce **Cannot capture this region**, with no partial preview or send. Hidden/clipped content and private subtrees are excluded from preflight checks where implemented.

Closed shadow roots cannot be reliably detected or read by ordinary page JavaScript; they are unsupported. Generated SVG resources, pseudo-elements, counters, box shadows, unsupported colors/layout, sticky/complex transformed content, fonts and live animations may differ or fail. Box shadows are not a fidelity guarantee. Font readiness is awaited, not pixel-identical rendering. Parsing/encoding failures stay visible and leave selection usable. Pinch zoom, nonstandard visual viewports and Firefox/Safari require separate certification. Do not use these images for pixel-perfect diffs or security evidence.

The adapter does not bypass CORS, proxy third-party content or expose hidden cross-origin pixels. Cloning may re-fetch normal page resources. Navigation/dynamic mutation is not an atomic compositor snapshot. These limitations also mean privacy redaction must never be represented as a security boundary.

## Transport and local access policy

Default `mcpWebhook: true` POSTs to **`http://localhost:3456/inspect`**. The MCP server must acknowledge `{ success: true, id: string, imageAccepted: true }`; generic legacy HTTP 200 is not success. The timeout is 15 seconds and may occur after persistence: check history before retrying to avoid duplicates. Browser CORS/local-network restrictions still apply.

Server options in `packages/mcp-server/src/server.ts`:

- `POINT_GRAB_HOST` defaults to **`127.0.0.1`** (loopback); `POINT_GRAB_PORT` defaults to **`3456`**. Deliberately binding a LAN/wildcard address broadens access.
- Capture POSTs to `/inspect` or `/grab` reject disallowed origins with HTTP 403. Defaults accept absent Origin, localhost/IPv4 loopback/`::1`, `.localhost`, `.local`, `.test`, `.internal`, and private IPv4 ranges `10/8`, `172.16/12`, `192.168/16` (any port). These are hostname-based checks, not DNS/network ownership verification.
- `POINT_GRAB_ALLOWED_ORIGINS` adds comma-separated, exact Origin strings. Add only trusted pages: captures flow into agent context. Origin filtering is not authentication; non-browser clients can omit/spoof Origin. Do not expose the listener to untrusted networks.
- Server host/port settings **do not change the browser plugin's fixed URL**. For a different destination, disable `mcpWebhook` and register exactly one plugin with `hooks.onScreenGrab(context, snippet): Promise<void>`. Resolve only after acknowledgement; reject on failure. No `onCopySuccess` fires for screenshot submission.

The envelope uses `html: '<!-- Screen Grab -->'`, `selector: 'screen-region'`, null source/component fields and `screenGrab: { mimeType: 'image/png', data: '<base64 without prefix>', width, height, region: { x, y, width, height }, comment }`. The server validates PNG signature/IHDR/base64 and metadata under a 4 MiB HTTP cap. Images persist in normal history (up to 50 captures); `POINT_GRAB_HISTORY_PATH` overrides its location.

`point_grab_get` returns an MCP **image content block**; recent/search return metadata/comments, and capture resources include an image/png blob. External AI-client display and installed stdio packaging need separate end-to-end verification.

## Evidence and release status

Source/tests describe the intended contract; this document is not a fresh execution report. `e2e/page-capture.spec.mts` covers open/nested/slotted shadow content and redaction, 2D canvas, blank WebGL warnings, filter approximation, rejection, cancellation and acknowledged retry. Angular blur-card and Web Components shadow-root regions must not be described as deliberate rejection cases merely because older docs did so.

See [release readiness](release-readiness.md) for pending gates. Historical browser totals and local passes do not establish current candidate or hosted CI success. The legacy `playwright.screen-grab.config.ts` aliases the page-capture suite; running both is duplicate coverage.

## Renderer references

- [html2canvas documentation](https://html2canvas.hertzen.com/documentation) and [supported CSS](https://html2canvas.hertzen.com/features/): DOM reconstruction, not native screenshots; the implemented adapter remains replaceable.
- [html-to-image](https://github.com/bubkoo/html-to-image) and [modern-screenshot](https://github.com/qq15725/modern-screenshot): alternative DOM/SVG approaches, not benchmarked or certified here.

Bundled MIT notices for html2canvas and its transitive dependencies live in `packages/core/THIRD_PARTY_LICENSES.txt`; release artifact inclusion remains a packaging gate. Root project licensing is unchanged.
