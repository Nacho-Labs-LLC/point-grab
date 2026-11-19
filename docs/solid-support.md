# Solid support

## Vite setup

```ts
import solid from 'vite-plugin-solid';
import pointGrabSolid from '@point-grab/solid/vite';

export default {
  plugins: [pointGrabSolid(), solid()],
};
```

Initialize once in the browser entry point:

```ts
import { initPointGrabSolid } from '@point-grab/solid';
const grab = initPointGrabSolid();
grab.showToolbar(); // Optional: expose actions immediately without activating the picker.
```

The pre-transform runs during Vite **serve only**, before Solid compiles JSX. It annotates intrinsic elements with their original JSX file/line/column and nearest named PascalCase lexical component. Inline `For`/`Show` render callbacks retain that component context. The default source root follows Vite's resolved root; `pointGrabSolid({ root })` overrides it explicitly. Dependencies and non-JSX modules are skipped. Existing explicit metadata is respected.

The runtime adapter installs component/source resolvers and strips instrumentation and hydration attributes from copied HTML. Caller-provided class filters and HTML cleaners are retained alongside the defaults. Native text selection, Ctrl/Cmd+C and editable inputs use the shared core keyboard contract.

### Metadata boundaries

This is compile-time source instrumentation, **not** React-style fiber emulation or an inspection of Solid's internal owner graph. The component stack follows annotated DOM ancestry. Contiguous repeated names collapse to their outermost annotated host; invisible wrapper components, portals, same-name recursive boundaries, anonymous default exports, and components which return no annotated intrinsic DOM do not have a guaranteed complete logical stack. Source location is the original intrinsic JSX location. Production builds omit injected development metadata; do not expect source context from an uninstrumented production bundle.

## Interactive demo

`examples/solid` is the Form / Field storefront: Solid signals and memos drive a three-item catalog, category/search/saved filters, nested `ProductCard` → `ProductArtwork`, and a `BagPanel` with reactive `For` items, conditional `Show` empty states, quantities, totals, clear, and a native gift-note input. All artwork is local CSS; no image service or font network request is required. It is a local playground, not a checkout or persistent store.

The shared Point Grab toolbar is visible on arrival. Its Actions menu exposes element comments and **Add screenshot**. Current-page capture selects directly over the live page and renders a DOM approximation before mandatory preview/comment/Send. It needs no upload, OS snipping or `getDisplayMedia`. It is not OS/compositor pixels. Open shadow DOM and exportable 2D canvas are supported with limitations; filters/blending produce approximation warnings. Intersecting media/iframes, cross-origin images and non-exportable canvases are rejected; closed shadow internals are unsupported. See [capture boundaries](screen-grab.md). Explicit Send requires a real acknowledged image transport, defaulting to the MCP webhook at `localhost:3456`; a hosted preview additionally needs the correct trusted Origin and browser network permissions. A health response alone does not establish Send permission. The floating toolbar can be dismissed if it overlaps content on a narrow viewport.

## Focused verification

From the repository root:

```sh
npx --yes pnpm@9.15.0 --filter @point-grab/solid test
npx --yes pnpm@9.15.0 --filter @point-grab/solid lint
npx --yes pnpm@9.15.0 --filter @point-grab/solid build
npx --yes pnpm@9.15.0 --filter point-grab-example-solid lint
npx --yes pnpm@9.15.0 --filter point-grab-example-solid build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome \
  npx --yes pnpm@9.15.0 exec playwright test --config examples/solid/playwright.config.ts
```

The dedicated browser suite starts **one** Solid Vite server on strict `127.0.0.1:5288`, uses one Chromium worker, and never starts the framework fleet or an MCP server. Without the executable override it uses Playwright's installed Chromium. It verifies real reactive catalog/cart interactions, clipboard selection and input copy, Solid component/source snippets, queued comment copy, actual current-page DOM-region capture/preview/cancel without upload or sharing APIs, and a 390px layout. Browser artifacts go to ignored `test-results/solid-demo` (override with `SOLID_TEST_OUTPUT`). This focused suite does **not** certify acknowledged MCP delivery, native OS capture, every framework, or CI enforcement; those require the separately owned cross-framework/transport harness.

### Cross-framework harness selectors

The former counter has been replaced. Add an item using `getByRole('button', { name: 'Add Arc lamp to bag' })`, assert `[data-testid="bag-count"]` equals `1`, then pick `.product-card h3` / the `Arc lamp` heading. Expected component: `ProductCard`; file: `src/App.tsx`. For dynamically inserted branch/list context pick `.bag-items strong` after adding; expected component: `BagPanel`.
