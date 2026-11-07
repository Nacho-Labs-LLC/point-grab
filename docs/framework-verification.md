# Cross-framework browser verification

## Reproduce

From the repository root, with dependencies installed:

```sh
pnpm install --frozen-lockfile
pnpm --filter './packages/**' --workspace-concurrency=1 run build
pnpm exec playwright install chromium
pnpm exec node scripts/verify-framework-matrix.mjs
pnpm exec playwright test --config=playwright.screen-grab.config.ts
```

To check only selected demos: `pnpm exec node scripts/verify-framework-matrix.mjs vue solid`.
For an approved preinstalled Chromium, set `AGENT_BROWSER_EXECUTABLE_PATH` to its executable.
The runner checks required package artifacts before starting, but does not rebuild them: rebuild after source changes.

The matrix is deliberately separate from legacy `playwright.config.ts`, which starts the entire demo/site fleet even when selecting one project. This harness starts exactly one Vite or Angular server at a time on strict `127.0.0.1:5188`, uses one Chromium worker, zero retries, no forced filesystem polling, and caps Angular build workers at one. It runs every requested framework even if an earlier framework fails, writes a machine-readable summary, and exits nonzero if any framework fails. Port 5188 must be free; an existing server is never reused.

Each browser context routes the demo's default `localhost:3456/inspect` transport to a **real ephemeral HTTP webhook listener** backed by the real MCP server and a disposable history file. This changes only test transport addressing, not payloads or successful responses. It prevents another local MCP user or concurrent browser suite from contaminating history. The SDK client retrieves the persisted capture using the real `point_grab_get` MCP tool over linked in-memory SDK transports. This certifies browser→HTTP webhook→file history→MCP image content, not MCP stdio process packaging. The separate core suite still requires exclusive port 3456.

## Per-demo contract

Two journeys run against **each actual demo**, not replacement test components:

1. Interact with framework-rendered UI and assert state changed; native selected-text Ctrl+C; pick an actual rendered element; inspect copied HTML and persisted adapter context; queue an existing element comment; open screenshot through **Actions → Add screenshot**; Cancel without sending or losing the queued comment; Confirm & Copy retains it.
2. Screenshot the rendered demo in Chromium; upload that actual PNG (with `navigator.mediaDevices` absent); recover from invalid image bytes; drag a 200×140 crop; compare every decoded crop pixel to the corresponding source PNG pixels; add a comment; force one HTTP 503; preserve preview/comment without persistence; retry through the real HTTP listener; verify acknowledgement ID, exact persisted preview bytes, dimensions/comment, and MCP image/text content. Ordinary clipboard content remains unchanged by image send.

| Demo | Actual interaction | Adapter evidence | Local Chromium result |
| --- | --- | --- | --- |
| Vanilla/core | Next track changes to Midnight Circuit | DOM HTML/text (no framework component expected) | 2/2 passed |
| React | Like count changes to 49 | Post component | 2/2 passed |
| Vue | Select Forest/M, add cart item, close cart | App component | 2/2 passed |
| Angular | Expand inspectable detail | PostCardComponent | 2/2 passed |
| Svelte | Create and rename note, sidebar updates | App component | 2/2 passed |
| Web Components | Hover real shadow-DOM tooltip, visible text | ForgeCard across shadow boundary | 2/2 passed |
| Solid | Add Arc lamp, bag count changes to 1 | ProductCard and App.tsx source | 2/2 passed |

The Web Components demo's buttons do not implement an application mutation; its real interactive tooltip is the asserted rendered interaction. This is not a claim of a working deploy/settings action. Angular and Web Components do not provide source-file metadata on these targets; component identity and DOM capture are asserted without inventing source fidelity. Solid is a real signal-driven storefront, not the original counter.

## Shared negative-path coverage

`playwright.screen-grab.config.ts` runs 11 additional core browser tests: reverse-drag crop and known pixels; Retake, Cancel and Escape; native ClipboardItem image paste and native text/input copy; browser DataTransfer image drop and invalid decode recovery; HTTP failure/retry; tiny selection and missing transport; legacy HTTP 200 without image acknowledgement; pending-send disabled controls/no double submission; queued comment preservation; built core demo entrypoint. These shared engine cases are not multiplied into seven identical adapter suites. File upload/crop/retry/Cancel and adapter integration do run in every framework.

No native OS snipping, permission-picker automation, OS file-manager drag, or screen-sharing adapter is implemented or certified. Screenshot intake is user file/paste/drop. No deployment is performed.

## Evidence and CI

Verified locally with `/opt/hermes/tools/chromium-1208/chrome-linux64/chrome`:

```sh
AGENT_BROWSER_EXECUTABLE_PATH=/opt/hermes/tools/chromium-1208/chrome-linux64/chrome \
  npx --yes pnpm@9.15.0 exec node scripts/verify-framework-matrix.mjs
# All seven frameworks passed: 14 browser tests total.

AGENT_BROWSER_EXECUTABLE_PATH=/opt/hermes/tools/chromium-1208/chrome-linux64/chrome \
  npx --yes pnpm@9.15.0 exec playwright test --config=playwright.screen-grab.config.ts
# 11 passed.
```

`test-results/framework-matrix/summary.json` records every framework exit status and duration; individual JSON reports live beside it. Traces and screenshots are retained on failure under `test-results/framework-matrix/<framework>/`. These generated paths are ignored by Git. Browser page errors fail tests. A green unit suite is not counted as browser evidence.

`.github/workflows/framework-matrix.yml` adds a dedicated PR/push/manual gate using frozen install, sequential package builds, runner-managed Chromium installation, the matrix, and the shared core suite, with failure artifacts. The workflow is written but has not been executed on GitHub in this local verification; hosting/CI runner behavior is not certified by a local pass. Existing legacy CI remains separate.

Initial failures exposed missing adapter build artifacts (now checked up front), stale test assumptions about the original Solid counter and top-level screenshot button, an extra click that dismissed an already-open comment popover, an unscoped Cancel collision with the Web Components demo, and interference from another suite writing to fixed port 3456 (now isolated on ephemeral HTTP ports). These were harness/prerequisite issues, not evidence for weakening the product assertions. No unresolved framework blocker remains in the final run.
