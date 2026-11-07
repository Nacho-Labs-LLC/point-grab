# Add screenshot (Screen Grab image transport)

The portable screenshot flow accepts **user-provided pixels**, independently of the page's DOM, framework or rendering technology. All adapters use the same core UI. Existing element selection, Add Comment / Confirm & Copy and native copy/paste outside the dialog remain available.

## Use

1. Take a screenshot with your operating system's screenshot/snipping tool (or another authorized source). PointGrab does not open that tool for you.
2. Open PointGrab's toolbar, choose **Actions** (the existing ellipsis dropdown), then **Add screenshot**. This is a normal dropdown option, not a separate prominent toolbar action; the existing copy/comment/history actions remain in place.
3. **Choose a screenshot file**, **paste an image while the intake dialog is focused**, or **drag/drop a file into the dialog**. PNG, JPEG and WebP are accepted. Text paste is not intercepted. The file picker can be used without Clipboard API permission or `mediaDevices`.
4. Drag a rectangle in either direction on the decoded image. The image retains its aspect ratio and fits the viewport. Live sizing reports source-image pixels; regions smaller than 8 × 8 image pixels are ignored. A too-large crop stays in selection so you can drag a smaller region. If the browser cannot prepare/encode a crop, the selection remains usable: try another region, Retake, or Cancel.
5. Review the cropped image and its dimensions, then enter a comment. **Retake** discards the current crop and returns to intake; select/paste/drop another screenshot. **Cancel** / Escape discards the unsent image and returns to the normal UI.
6. **Send image + comment** explicitly sends only the PNG crop, its dimensions/source-pixel rectangle and your comment. The full source image is never transmitted. Send, Retake and Cancel are disabled while a send is awaiting acknowledgement: closing UI cannot undo an in-flight server write. The preview and comment stay available on failure, for retry or Cancel. The preview closes and local history is updated only after acknowledgement.

The source file is decoded locally; temporary object URLs are revoked. Supported files are limited to 20 MiB, 16384 pixels per side and 64 megapixels. Output crops are limited to 2 MiB PNG, 8192 pixels per side and 16 megapixels. Comments are limited to 10,000 characters. No redaction tool is included: select only content you intend to share or Cancel. Images and comments persist with capture history; treat that storage as sensitive.

The product never writes image data to the clipboard or reads it proactively. A native paste event supplies the image, and a normal file picker is the fallback if the platform does not provide image clipboard data. Existing history copy copies the text summary only.

## Original-request gap: no direct native screen snip

**Direct in-page, permission-free capture of arbitrary screen pixels remains unimplemented and is not possible for an ordinary webpage.** The browser security boundary requires a permission API such as screen sharing, or a privileged desktop/browser integration. This implementation deliberately does not mandate screen sharing, an extension or a desktop app. It does not use `getDisplayMedia`, fabricate a screenshot by rendering the DOM, or claim to invoke a native snipping tool. “Add screenshot” describes what is actually implemented. Relative to a one-click native screen-snipping request, this is a **partial solution**: the user must obtain the screenshot first.

No speculative capture-source plugin API was added. The existing image-only `ScreenGrab` attachment and `onScreenGrab` transport hook remain reusable for a future explicitly authorized source integration.

## Transport

With default `mcpWebhook: true`, the built-in plugin POSTs to `http://localhost:3456/inspect`. Use the updated MCP server from this branch: older text-only servers are not sufficient. The client requires `{ success: true, id: string, imageAccepted: true }` and does not claim success from an old server's generic HTTP 200 acknowledgement. Network timeout is 15 seconds. An ambiguous timeout can occur after persistence; check history before retrying to avoid duplicates. Transport reachability, CORS and local-network browser policies still apply; portable intake does not guarantee every browser can reach a localhost MCP server.

The existing history envelope uses `html: '<!-- Screen Grab -->'`, `selector: 'screen-region'`, null component/source fields and a `screenGrab` attachment:

```ts
interface ScreenGrab {
  mimeType: 'image/png';
  data: string; // base64, no data URL prefix
  width: number; // actual PNG pixels
  height: number;
  region: { x: number; y: number; width: number; height: number }; // source-image pixels
  comment: string;
}
```

No component/source metadata is invented for a rectangular screenshot. The HTTP body cap is 4 MiB. The server validates base64, PNG signature, IHDR dimensions and attachment metadata before persistence. Images persist with normal capture history on disk (up to 50 captures).

`point_grab_recent` / `point_grab_search` expose attachment metadata and comment. `point_grab_get` returns the PNG as an MCP **image content block**, not base64 prose. Capture resource reads return JSON metadata plus an `image/png` blob resource. A receiving AI client must support these MCP content types; no claim is made about any particular external client's rendering.

For a custom destination, disable `mcpWebhook` and register exactly one plugin with `hooks.onScreenGrab(context, snippet): Promise<void>`. Resolve only after your destination acknowledges receipt; reject on failure. Legacy `onCopySuccess` is deliberately not fired because no clipboard copy occurred. Custom transports are responsible for their own validation, privacy and acknowledgement.

## Verification

Run from the repository root (use `npx --yes pnpm@9.15.0` in place of `pnpm` if needed):

```bash
pnpm --filter @point-grab/core test
pnpm --filter @point-grab/mcp-server test
pnpm --filter @point-grab/core lint
pnpm --filter @point-grab/mcp-server lint
pnpm --filter @point-grab/core build
pnpm --filter @point-grab/mcp-server build
pnpm exec playwright test --config playwright.screen-grab.config.ts
```

Set `AGENT_BROWSER_EXECUTABLE_PATH` when using an existing Chromium executable rather than Playwright's installed browser. The dedicated config uses one worker, an ephemeral static web server, disposable file history and a test-owned webhook on port 3456 (must be free). It loads the built core bundle and demo; it does not launch the framework demo fleet or poll external services. Successful teardown removes the disposable history; a process crash can leave its scratch directory.

The real Chromium suite uploads an actual PNG screenshot file, verifies a reverse-drag crop's dimensions and pixels, comments, HTTP acknowledgement/persistence and retrieval through a real MCP SDK client/server linked transport. It also verifies native clipboard image paste, file drop event delivery/decoding, decode failure, Retake/Cancel/Escape, transport failure/retry, rejection of legacy text-only acknowledgements, pending-send locking, missing transport, tiny crops, native text copy/paste, preservation of queued existing comments and the built core demo. `mediaDevices` is removed during intake tests. Browser image clipboard permissions are granted by the test runner, not requested by product code. The drop event supplies a real File/DataTransfer but does not automate an OS file-manager drag. The suite is locally runnable and not yet wired into CI.

This certifies the portable source-to-MCP pipeline in Chromium. It does not certify native snipping, OS screenshot tools, other browser engines/mobile, any external AI app's image display, or a deployed service. No native-picker test or synthetic sharing fallback is needed because this flow does not request screen sharing.
