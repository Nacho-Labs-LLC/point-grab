# Screen Grab

Screen Grab is a separate, explicit screenshot flow shared by all adapters through core. Existing element selection and Add Comment / Confirm & Copy behavior remain available.

## Use

1. Activate PointGrab with the existing shortcut (or call `showToolbar()`). Selected text retains normal Ctrl/Cmd+C copy behavior.
2. Click **Screen Grab**, then **Start sharing**. This is the only action that requests browser capture permission.
3. Choose **this browser tab** in the native sharing picker. Window/monitor capture is rejected. The browser may offer other tabs; PointGrab cannot verify tab identity, so check the preview carefully.
4. Sharing stops immediately after a single still frame is available, before you drag or type. Drag a rectangle in any direction on that still. Regions smaller than 8 × 8 viewport pixels are ignored.
5. Review the cropped image and enter a comment. **Retake** discards the crop and returns to the explicit sharing step. **Cancel** / Escape discards the unsent capture.
6. **Send image + comment** sends only the crop, its dimensions/region and your comment. The full frame is never transmitted. The preview stays open with an error on transport failure; it closes and enters local history only after acknowledgement.

The flow requires HTTPS or localhost, `getDisplayMedia`, and browser-tab capture with `displaySurface: 'browser'`. This is primarily a desktop Chromium path; mobile/Safari/Firefox availability depends on browser support. Unsupported capture and denied permissions show a recoverable error, not a fabricated DOM screenshot.

Screen Grab does **not** write image data to the clipboard. The existing history action copies the text summary only. No redaction tool is included: select only non-sensitive content or Cancel.

## Transport

With default `mcpWebhook: true`, the built-in plugin POSTs to `http://localhost:3456/inspect`. Use the updated MCP server from this branch: older text-only servers are not sufficient. The client requires `{ success: true, id: string, imageAccepted: true }` and does not claim success from an old server's generic 200 acknowledgement. Network timeout is 15 seconds. An ambiguous timeout can occur after persistence; check history before retrying to avoid duplicates.

The context uses the existing history envelope with `html: '<!-- Screen Grab -->'`, `selector: 'screen-region'`, null component/source fields and a `screenGrab` attachment:

```ts
interface ScreenGrab {
  mimeType: 'image/png';
  data: string; // base64, no data URL prefix
  width: number; // actual PNG pixels
  height: number;
  region: { x: number; y: number; width: number; height: number }; // selection viewport pixels
  comment: string;
}
```

No component/source metadata is invented for a rectangular screenshot. PNGs are limited to 2 MiB, 8192 pixels per dimension, 16 megapixels and a 10,000-character comment. The HTTP body cap is 4 MiB. The server validates base64, PNG signature, IHDR dimensions and attachment metadata before persistence. Images persist with normal capture history on disk (up to 50 captures); treat that file as sensitive.

`point_grab_recent` / `point_grab_search` expose attachment metadata and comment. `point_grab_get` returns the PNG as an MCP **image content block**, not base64 prose. Capture resource reads return JSON metadata plus an `image/png` blob resource. A receiving AI client must support these MCP content types; no claim is made about any particular external client's rendering.

For a custom destination, disable `mcpWebhook` and register exactly one plugin with `hooks.onScreenGrab(context, snippet): Promise<void>`. Resolve only after your destination acknowledges receipt; reject on failure. Legacy `onCopySuccess` is deliberately not fired because no clipboard copy occurred. Custom transports are responsible for their own validation, privacy and acknowledgement.

## Verification

Run from the repository root after a frozen install:

```bash
pnpm --filter @point-grab/core build
pnpm --filter @point-grab/mcp-server build
pnpm --filter @point-grab/core exec vitest run --maxWorkers=1
pnpm --filter @point-grab/mcp-server exec vitest run --maxWorkers=1
pnpm --filter @point-grab/core lint
pnpm --filter @point-grab/mcp-server lint
pnpm exec playwright test --config playwright.screen-grab.config.ts
```

The dedicated browser config uses one worker, one ephemeral static web server, disposable file history and a test-owned webhook on port 3456 (must be free). It loads the built core bundle and core demo; it does not launch the framework demo fleet or use polling. Chromium's test-only source-selection flag chooses the test tab **after** the UI sharing click. Production code never bypasses the permission picker.

If the host browser cannot run the native picker, this explicit fallback verifies real browser UI, video/canvas cropping, track cleanup, HTTP persistence and MCP image retrieval, but **does not verify native sharing permissions or real tab pixels**:

```bash
POINT_GRAB_TEST_CAPTURE=canvas pnpm exec playwright test --config playwright.screen-grab.config.ts
```

This fallback stubs only `getDisplayMedia` to return a real canvas MediaStream with known pixels. Native capture must still be certified on a functioning desktop browser. The suite is locally runnable; the new dedicated config is not yet wired into CI.
