# Framework demos — canonical source

`examples/` is the **only maintained demo source**. These apps are intended for StackBlitz; there is no separate hosted-demo source tree, and no second set of app files to keep synchronized. Local servers exist for development and verification, not as another public demo destination.

## The seven demos

| Framework | App | Point Grab integration / configuration |
| --- | --- | --- |
| Vanilla | Wavely player: playback, queue, seeking, likes, shuffle/repeat | [`vanilla/main.js`](vanilla/main.js) |
| React | Thread feed: posts, replies, saved items and live updates | [`react/src/App.jsx`](react/src/App.jsx) |
| Vue | Krate product: variants, validation, personalization and cart | [`vue/src/main.js`](vue/src/main.js) |
| Angular | Task board: filters, creation, task drawer and editing | [`angular/src/main.ts`](angular/src/main.ts) |
| Svelte | Inkwell notes: creation, search, tags, selection/caret formatting | [`svelte/src/main.js`](svelte/src/main.js) |
| Web Components | Service dashboard: shadow DOM, service creation and deployment | [`web-components/main.js`](web-components/main.js) |
| Solid | Object shop: signals, filtering, bag quantities and gift note | [`solid/src/main.tsx`](solid/src/main.tsx), [`solid/vite.config.ts`](solid/vite.config.ts) |

Keep each app framework-native. Fix its source here, then update the corresponding StackBlitz project from the same files. Do not hand-maintain another mirror or commit generated export trees.

## Required plugin demonstrations

A successful install or an attractive app is not enough. The hosted demos must retain the existing shared journeys and their framework-specific metadata:

- **Point and inspect:** hold Ctrl+B, or use toolbar selection; hover, switch targets and grab a real class-bearing element. Check HTML, selector, authored classes and available component/source/ancestor metadata. Do not invent source locations when a framework cannot supply them.
- **Actions:** Copy Element, Copy HTML and Copy Styles both before and after selecting, then after replacing the target. Inspect the real clipboard output. Classes appear in the applicable HTML/context/toast; Copy Styles produces computed declarations. There is no separate Copy Classes action.
- **Comments:** cancel/empty drafts, edit before adding, queue one or multiple elements (including the same target again), continue inspecting, then Confirm & Copy. Check the actual combined prompt and queue cleanup. Preserve comments if clipboard access fails.
- **Freeze:** toolbar and configured freeze key; retain actual animation/hover detail while selecting and commenting. Unfreeze, Escape, disable and dismiss must clean up and resume appropriate motion. This is visible DOM/animation freezing, not suspension of framework state or JavaScript timers.
- **Current-page image context:** Actions → Add screenshot → drag → mandatory preview/privacy warnings/comment. Exercise Retake, Cancel/Escape, acknowledged Send, failure and retry without losing work. This is a DOM-rendered region of the current page, not arbitrary screen sharing, upload, paste or image-clipboard copy. See the [capture contract](../docs/screen-grab.md).
- **Toolbar and recovery:** light/dark/system themes, history empty/populated/re-copy/clear, enable/disable, show/hide, native text-field shortcuts and permission failures. Verify 360px control legibility as well as clickability: pointer-events:none labels can obscure buttons without blocking clicks.
- **Real app interactions:** use the player/feed/cart/board/editor/dashboard/shop, not a static mock. Inspect and freeze the framework-native dynamic content without breaking its normal inputs, controls or shadow boundaries.

The detailed executed journey inventory is in [visual review](../docs/visual-review.md), backed by [`e2e/framework/`](../e2e/framework/). Its local Chromium recording is evidence for that recorded checkout—not proof that a StackBlitz import works.

## Configuration and extension use cases

Use the integration files above to demonstrate configuration directly in the editable StackBlitz source rather than adding seven redundant settings applications:

- `activationKey`, hold/toggle `activationMode`, `keyHoldDuration`, and `freezeKey`;
- `enabled`, `enableInInputs`, `devOnly`, `showToolbar`, theme and `maxContextLines`;
- class filters and HTML cleaners, while retaining the adapter's framework behavior;
- the returned API's option updates, activation, toolbar/history/theme methods and disposal;
- plugin registration/unregistration, copy transformations/hooks, custom theme and custom component/source/element resolvers.

These are supported API examples to expose and verify, not a claim that every option already has a dedicated visible control or hosted test. Use the [public API definitions](../packages/core/src/types.ts) and [framework guides](../README.md#framework-guides) for the exact API and adapter access patterns. Solid's build-time JSX plugin must remain enabled for its instrumented source/component context.

## StackBlitz delivery status and constraints

**The canonical sources are not yet standalone StackBlitz projects.** Their `workspace:*` dependencies resolve the current local core/adapters, including unreleased fixes. Importing an example subfolder alone cannot access sibling workspace packages. Changing those ranges to the old published `0.1.6` packages would silently demonstrate different code.

Before restoring public “Open in StackBlitz” links:

1. Use an explicit, verified dependency delivery method: either a working full-workspace import with the required package build/start flow, or a standalone export using a chosen matching package artifact/version. Any export is a generated delivery artifact, not a second maintained app. Do not publish packages or silently substitute an older release just to make an import boot.
2. Verify each framework's actual toolchain in WebContainers, especially native build-tool dependencies and Solid's instrumentation. Solid also inherits `../../tsconfig.json`; a subtree export must supply its compiler settings rather than retaining a broken parent reference. Root-owned test tooling is not automatically included in a standalone project. Local builds alone do not prove this.
3. Verify the real preview's clipboard, shortcut focus, hover/Freeze and image-preview behavior. Focus the preview rather than the code editor; use a popped-out preview if iframe permissions interfere, and document actual limitations.
4. Run the browser-only journeys without implying that a backend is connected. Then separately verify the real connected workflow below.
5. Save/update the account-owned project, read it back, and retain its verified URL. Only then wire the hosted link into the website. Until then, website cards link to these example sources rather than unverified or deleted projects.

### Browser-only versus connected MCP/image workflows

Element clipboard output, comments, inspection, Freeze and image selection/privacy preview run in the browser. **Successful screenshot submission and AI-agent/MCP retrieval require a real acknowledged transport.** Do not replace them with success toasts, fake acknowledgements or in-memory delivery presented as MCP.

The default webhook is `http://localhost:3456/inspect`; in a hosted preview, localhost refers to the viewer's machine, not automatically to a server running inside WebContainers. The examples already expose MCP connection status. A reachable `/health` response does not prove an image POST is allowed or persisted.

For a local MCP server, its exact preview Origin must be trusted via `POINT_GRAB_ALLOWED_ORIGINS` when outside the default local-development allowlist; browser local-network/CORS restrictions may also apply. Do not broadly expose the loopback listener to make a demo work. A different destination requires `mcpWebhook: false` plus a real `hooks.onScreenGrab` transport that resolves only after acknowledgement. See [transport and local access policy](../docs/screen-grab.md#transport-and-local-access-policy).

Connected acceptance must include PNG+comment persistence and retrieval through the real MCP client. Clearly distinguish offline preview, intentional rejected capture, transport failure and actual acknowledged success.

## Local development and verification

From the repository root, use the existing pnpm workspace and build gates:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter point-grab-example-vue dev
```

Choose the corresponding example package for another framework. Keep local verification pointed at these same files. Root `pnpm run test:e2e` covers the seven-framework matrix plus dedicated capture/Freeze/site/Solid suites; opt-in `pnpm run test:e2e:review` retains reviewable recordings. No StackBlitz account edits, Git pushes or package publication are implied by local verification.
