# Visual functionality review

Publication is on hold pending Nate's visual review and explicit approval. A passing automated test run is not visual acceptance or authorization to publish.

## Expanded acceptance scope — November 18, 2026

**Vanilla is the shared-control base.** The corrected complete recording, **`full-r4`**, passed **314 tests across 11 suites**, with **178/178 required checklist rows**, **314 attempts**, and **zero failures, skips, unrun tests or retries**. This is local Chromium evidence, not human acceptance or release approval. Root test/lint/build and expanded-spec TypeScript checks pass; core tests **117/117**, evidence-tool tests **9/9**.

### Completed corrected recording — full-r4

**Repository follow-up:** the duplicate demo tree has since been removed; [`examples/`](../examples/README.md) is the sole maintained demo source for StackBlitz. Website cards now link to all seven canonical example sources, including Solid, until verified hosted URLs exist. Root test/lint/build and both affected site browser tests passed with retries disabled (`canonical-examples-cleanup.log`, `canonical-examples-final-site.log`). The 314-test gallery remains the frozen `full-r4` recording before that catalog/link cleanup, not a new full-matrix or hosted StackBlitz verification claim.

Open **http://192.168.50.166:8080/point-grab-review-2026-11-18-full-r4/** on the LAN. Use the functional checklist to jump to actual executed journeys, or search by framework/behavior. Actual clipboard text and sampled animation JSON are expandable in each test, alongside videos, checkpoints and trace downloads.

**Pre-commit follow-up:** independent core, release/cleanup and evidence-harness review completed; the harness review's two blockers were fixed and re-reviewed. Recording now rejects overlap with runner cleanup directories and independently lists every suite with focused tests forbidden, then compares exact recorded test identities against that inventory. Fresh local gates passed: **315 browser tests across 11 suites**, **16 evidence/discovery regression tests**, root test/lint/build, expanded-spec TypeScript and all eight package clean-consumer install checks. A real two-test site recording also matched its independent inventory. The 315-test run includes the later canonical-source catalog regression; it is not a replacement full video gallery. Logs: `/workspace/point-grab-release-evidence/precommit-final-gates-r2.log`, `precommit-evidence-fixes.log`, `precommit-harness-smoke.log`. This is local commit verification, not hosted CI, npm publication, external-client certification or human visual approval.

| Suite | Passing tests |
| --- | ---: |
| Site | 1 |
| Vanilla base + player | 43 |
| React | 37 |
| Vue | 39 |
| Angular | 42 |
| Svelte | 44 |
| Web Components | 40 |
| Solid | 40 |
| Page capture | 20 |
| Freeze fixtures | 4 |
| Dedicated Solid storefront | 4 |
| **Total** | **314** |

Retained evidence: **314 videos, 1,483 PNGs, 314 traces, 209 text attachments and 98 JSON attachments**, totaling approximately **3.56 GiB**. All 2,418 attachments were checked for nonempty files and expected image/video signatures, valid JSON/UTF-8, and readable ZIP traces with valid CRCs. Summary and per-suite JSON files contain the actual executed test IDs and counts.

Real Chromium loaded the final gallery with 314 test articles and 178 checklist rows, none missing; searching `framework-vue` showed its 39 tests. A checklist link cleared that filter and exposed Vue's phone recording; its video decoded at 1440×1000, with advancing playback and no media error. This proves the review surface works from this environment, not from Nate's device.

The latest root `pnpm run test`, `pnpm run lint`, and `pnpm run build` passed after recording; core tests passed **117/117**, evidence-tool tests **9/9**, and expanded browser specs passed TypeScript checking. Root Turbo used caching; these are not zero-cache claims. Logs are under `/workspace/point-grab-release-evidence/`, including `expanded-recording-r4.log` and `final-r4-quality-gates.log`.

Earlier runs remain separate, not mixed into `full-r4`. Interrupted `full-r1` exposed an obscuring history toast and a test selecting the progress bar's deepest fill child rather than its parent slider. `full-r2` passed assertions but frame QA exposed a pointer-events:none selector label covering phone Confirm & Copy despite successful click hit-testing; its gallery is visibly **SUPERSEDED**. The paint hierarchy now keeps labels/feedback below interactive controls, with an explicit regression assertion. `full-r3` was rejected for one site retry caused by waiting on continuously tracking inspection geometry. Settling now targets only interactive panels/toolbar/toast; three repeated site recordings passed with retries disabled before the clean `full-r4` run.

Fresh final-run frames were visually inspected: Vue, Svelte and Solid 360px confirmation buttons/count **1** are readable and unobscured; Angular's populated 360px comment editor and Cancel/Add to Review fit. The focused Vue cart frame shows both line prices, **$144** total, close/remove/review controls entirely inside the viewport. Intentional overlays can cover background demo content; this is distinct from obscuring their own controls. Representative frame review is not an exhaustive manual audit of all 1,483 images. One independent Web Components frame-inspection step was blocked by a tool approval timeout; no manual visual pass is claimed for it. Its **40 automated browser tests and retained recordings** did pass.

| Surface | Required journeys |
| --- | --- |
| Every framework: Copy Element / HTML / Styles | Pending picker, established target without repicking, replacement target, authored classes/cleaned adapter metadata, exact real clipboard output |
| Every framework: comments | Empty/whitespace rejection, revise draft, Cancel/Escape, one item, multiple targets, cancel an extra draft without losing queued work, repeated target appends another note, explicit confirmation, fresh batch, continue picking after an ordinary grab |
| Every framework: Freeze | Actual moving animation before/after pause; toolbar and keyboard on/off; pointer-away hover detail; commenting on frozen content; Escape, selection-off, power-off and Dismiss cleanup; re-enable and real application interaction |
| Every framework: recovery | Pending Copy Element history re-copy; disabled F; text-field F/Ctrl+B including open-shadow inputs; deliberate clipboard denial retains queued comments and succeeds on retry |
| Every framework: screenshots | Retake/recapture; freeze preserved through preview, failure and retry; real HTTP acknowledgement; pending-send controls locked; focus containment/return; Cancel/Escape; transmitted PNG and MCP retrieval; screenshot-history textual re-copy |
| Every framework: phone | 360px toolbar, light/dark surfaces, Actions, real comment editor, reachable queued confirmation, history |
| Vanilla base controls | Actual dark/light/system palettes, live OS changes, reload default; history empty/two grabs/order/re-copy/clear/reopen; selection on/off and native app clicks; power gates actual grabs; Dismiss/shortcut reopen; menu inventory/toggle/Escape/outside dismissal/panel exclusion |
| Vanilla player | Volume/popover; shuffle; repeat/end-of-track behavior; pointer and keyboard seek; simulated playback resume/pause; per-track like/unlike retention |
| React feed | Composer/reactions/saves/filter; repost; actual reply submit and draft retention; timed banner dismissal; return to full feed |
| Vue product | All color backgrounds and size selections; monogram; validation; cart items/totals/removal; empty cart; dismissal; keyboard containment/focus return |
| Angular board | New-task validation/assignee/label; Cancel/backdrop; forward/backward moves; search/priority empty/reset; drawer rename/status; checklist both directions |
| Svelte notes | Search/create; selected/caret Bold/Italic/Heading/Link; toolbar close; live count; two edited titles/bodies retained across switches; Updating → In this tab only |
| Solid store | All categories/combined filters; empty/reset; save/unsave; multiple bag lines and quantities; decrement/removal/clear; note retained across filtering |
| Web Components console | Deploy/rollback; busy locks and create-during-deploy; new-service validation/duplicate-name correction; Cancel/backdrop; nested-shadow grabs and native text entry |

The real menu exposes **Copy Element, Copy Styles, Copy HTML, Add Comment, Add screenshot and Clear History**. There is no separate Copy Classes action: classes appear in serialized HTML, selectors and metadata; computed CSS is a different output. There is also no queued-item edit/remove UI, draggable toolbar, durable demo storage, real audio/payment/deployment, or external-client certification claim. Tests must not fabricate those features.

The gallery's functional checklist requires passing journeys with named visual checkpoints per framework and actual text attachments for copy/comment outputs, in addition to the complete suite and per-test screenshots/videos/traces. Actual text/JSON attachments are previewable in the gallery. A green test count alone cannot satisfy this gate. Human visual acceptance remains separate.

Browser regressions exposed and fixed frozen-state exits, disabled-F activation, shadow-input shortcut interception, empty pending-action history output, comment continuation after an ordinary grab, comment loss after clipboard denial, picker cursor contamination in computed CSS, phone-width comment clipping, menu Escape dismissal, history labels obscured by copy feedback, and false duplicate-service success. Failed probe logs remain under `/workspace/point-grab-release-evidence/`; their reports are not mixed into the completed replacement run.

## Recorded review — November 17, 2026

**Superseded as acceptance evidence:** Nate's review identified material functional gaps in this 150-test recording. It proves only the tests it ran, not complete framework functionality. Use the expanded recording above instead; release approval remains pending. The original gallery is visibly marked accordingly.

Open **http://192.168.50.166:8080/point-grab-review-2026-11-17-r2/** on the LAN.

The completed run has **150 passing tests across 11 suite reports**, with **150 videos, 267 PNG screenshots, 150 traces and 15 copied-context/prompt text attachments**. No failures, skipped tests, unrun tests or retries were reported. The gallery checks that every test attempt has screenshot, video and trace evidence. Files occupy approximately 614 MiB in `/workspace/nginx-serve/point-grab-review-2026-11-17-r2/`.

Command executed: `pnpm run test:e2e:review --output /workspace/nginx-serve/point-grab-review-2026-11-17-r2` using pnpm 9.15.0 via the existing npx/corepack wrapper. Chromium used `AGENT_BROWSER_EXECUTABLE_PATH` and Solid used the same executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Playwright's FFmpeg was installed in the scratch-scoped `PLAYWRIGHT_BROWSERS_PATH`. Provenance and full logs accompany the gallery.

Gallery, summary and a video URL returned HTTP 200. A real Chromium check confirmed search filters to React's 17 tests and one suite, and a video decoded at 1440-pixel width with advancing playback time. A selected React review-modal checkpoint was visually inspected: modal, comment and controls are readable; the selected region crops the post text, as expected for a bounded region rather than a full-element capture. This is a spot check, not Nate's acceptance of every recording.

Seven focused evidence-tool tests and a targeted TypeScript check of all five configs plus the two helpers passed. The first attempted recording failed before any tests because a helper used `import.meta` when loaded as CommonJS; that was fixed for both root CommonJS and Solid ESM configs. The failed run is preserved separately, not mixed into the successful review. Independent code review passed with no blockers and independently confirmed the media files are nonempty with expected signatures/trace entries. This establishes code/artifact integrity, not Nate's visual approval.

## Record the full existing browser suite

With dependencies installed and packages built:

```sh
pnpm exec playwright install chromium
pnpm run test:e2e:review
# Or select a NEW output directory; existing review output is never overwritten:
pnpm run test:e2e:review --output /absolute/path/to/new-review
```

The review command runs the existing sequential site, seven-framework, page-capture, Freeze and dedicated Solid suites. Review mode retains videos, screenshots and traces for passing as well as failing tests; ordinary `test:e2e` keeps its lightweight defaults. Recording requires Playwright's FFmpeg installation, which the browser install above includes. For an existing custom Chromium installation, set both `AGENT_BROWSER_EXECUTABLE_PATH` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the executable and run `pnpm exec playwright install ffmpeg`.

Open the generated `index.html` through a local/static HTTP server. The gallery groups actual test results by suite/framework, offers videos and named screenshot checkpoints, and links recorded traces and actual copied prompt/context text where attached. Partial runs, failures, skips and retries must remain visible rather than presented as a complete green run.

## Suggested review order

1. Site live demo: select two real elements, add comments, confirm the batch, inspect the actual copied prompt.
2. Each framework: arrival/connected toolbar, hold-to-grab and adapter context/history, toolbar selection, Copy HTML/Styles, multiple comments.
3. Freeze: hover detail retained after the pointer leaves; Escape resumes motion. Keyboard-focus, reduced-motion and shadow-animation regressions are also recorded.
4. Screenshot journey in each framework: selected-region preview → Retake → recapture/comment → intentional HTTP 503 → preserved work → acknowledged retry → persisted screenshot history. The injected 503 is an intentional failure-path test; the successful retry uses the real isolated MCP listener.
5. Redaction previews and narrow phone layouts.
6. Shared capture fixtures: exact pixels/DPR/scroll, shadow content, 2D canvas, approximation warnings, unsupported-media rejection, cancellation and locked pending-send controls.
7. Framework-specific demo interactions and the dedicated Solid storefront/mobile scenarios.

Named checkpoints briefly hold the real UI for readability only in review mode. They do not inject product state, replace real capture pixels or weaken assertions. Videos are recordings of automated tests, not a narrated tutorial. Some shared suites use deliberately simple controlled fixtures; those are labeled separately from real framework demos. Traces provide inspection detail that a video cannot expose (actions, DOM snapshots, assertions and network activity).

## Boundaries

This is local Chromium evidence against the current dirty checkout, not hosted CI, other-engine certification, installed external AI-client image display or proof of pixel-perfect DOM rasterization. Review artifacts contain rendered fixture/demo data, source paths and captured requests; serve only the dedicated evidence directory on the intended private review surface. Do not publish traces or copy a whole workspace into a web root.

Generated artifacts belong outside source control. Keep the selected evidence run available until review is complete; do not remove a session-attached workspace or overwrite previous review evidence as cleanup.
