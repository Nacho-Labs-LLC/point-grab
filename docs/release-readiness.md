# Point Grab release readiness — unreleased

**Publication hold:** Nate requires reviewable screenshots/videos of the real functionality before considering release. See [visual review](visual-review.md). Do not tag, push or publish based on automated green results alone; obtain explicit approval after visual review.

## Candidate and version decision

- Candidate baseline: **`22a639d`** on `naterchrdsn/recover-inflight-work-release`, consolidated in `/workspace/point-grab`. Subsequent release-preparation edits require fresh verification; this is not a tag or published version.
- All eight package manifests currently declare **`0.1.6`**. **Release version/bump policy is undecided**; do not infer a new version from these notes. Decide the coordinated package/dependency version changes before tagging or publishing.
- This document records local verification and pending release gates. Local results are not hosted CI, deployment or registry results. No publication is authorized by these notes.

## Unreleased changes

- **Breaking default shortcut:** activation is now **Ctrl+B on every platform**, including macOS (Control, not Command), rather than the old Ctrl/Cmd+C default. Native copy remains with the browser by default. Users needing the former behavior can explicitly configure `activationKey`; modifiers match exactly. Hold remains the default activation mode, with configurable toggle mode.
- **Configurable Freeze:** `freezeKey` is a single key (default `'F'`), configurable at initialization and via `setOptions`, with the toolbar label reflecting the setting. Freeze and screenshot selection/review are separate lifecycles; screenshot mode automatically holds the visible-page freeze.
- **Current-page screenshots:** mandatory preview and explicit acknowledged PNG+comment submission; retry retains the preview/comment. Open/nested/slotted shadow content and exportable 2D canvas are not blanket rejections. Filter/backdrop-filter and blend effects carry approximation warnings; blank canvas exports carry a warning. Unsupported media, cross-origin images and tainted canvases still reject. See [capture contract and privacy caveats](screen-grab.md).
- **Local webhook restrictions:** listener defaults to `127.0.0.1:3456`; `POINT_GRAB_HOST`/`POINT_GRAB_PORT` opt into other bindings. Capture POSTs accept local-development origins or explicit comma-separated `POINT_GRAB_ALLOWED_ORIGINS` additions; disallowed origins receive 403. Missing Origin is accepted, so this is not authentication. The browser plugin still targets `http://localhost:3456/inspect`; a changed destination needs a custom image transport with `mcpWebhook: false`.

## Evidence boundary

The historical **170 executions included 20 duplicates**: `playwright.screen-grab.config.ts` aliases the page-capture suite. That total is not 170 independent tests and is not a current candidate pass. Older demo-rejection descriptions and historical unit/browser totals must not substitute for newly collected reports. `docs/framework-verification.md` retains historical assertions; interpret them as historical, not release certification.

## Gates pending before release

- [ ] Decide release version and migration wording for the breaking shortcut; align all package versions and internal dependency ranges.
- [x] Run fresh frozen-install, unit, type/lint and build gates on the current candidate. Rerun affected gates after any subsequent code/version changes.
- [x] Finish the corrected expanded recording after the phone label/toolbar stacking fix: **`full-r4` passes 314/314 tests, 11 suites, 178/178 required checklist rows, zero failures/skips/unrun/retries**. Earlier insufficient, visually defective or flaky runs remain separate. Final gallery/search/video playback, artifact integrity and representative phone frames are verified. See [expanded scope and review evidence](visual-review.md). Human visual acceptance remains pending.
- [ ] Verify packaged tarballs/entry points, declarations, bundled lazy renderer/global bundle, dependency resolution, MIT notices and clean-consumer installation. Exercise the installed MCP stdio path and an external client image display; source-tree tests alone do not certify them.
- [ ] Verify loopback binding, origin rejection/explicit allowlisting, custom host/port transport setup and privacy limitations against the final artifact.
- [ ] Review final diff and repository cleanliness; confirm packaging and CI wiring. Record actual hosted CI results if run—local results are not hosted CI evidence.
- [ ] Obtain explicit approval for commit/tag/push/publication after gates pass. Preparation does not authorize publishing.

## Local verification — November 17, 2026

Environment: Linux, Node `v26.12.1`, pnpm `9.15.0`, installed Turbo `2.11.7`; browser suites used the existing Chromium executable selected by `AGENT_BROWSER_EXECUTABLE_PATH`, with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` set to the same path for Solid. This is local Chromium evidence, not certification of the workflow's downloaded browser or hosted CI.

Commands were run from `/workspace/point-grab` through `npx --yes --package=corepack --package=pnpm@9.15.0 -c '<command>'`:

```sh
pnpm install --frozen-lockfile
pnpm run test --cache=local: --concurrency=1
pnpm run lint --cache=local: --concurrency=1
pnpm run build --cache=local: --concurrency=1
pnpm run test:e2e
pnpm run verify:release
```

All commands exited successfully. Turbo reported zero cached tasks. Browser counts: site 1; Vanilla 17, React 17, Vue 17, Angular 18, Svelte 17, Web Components 18, Solid 17; page capture 20; Freeze 4; dedicated Solid storefront 4. Total: **150**, with the capture alias excluded. The release script packed and clean-installed all eight packages; installation alone does not prove every exported entry point or installed MCP stdio behavior.

Evidence: `/workspace/point-grab-release-evidence/quality.log`, `browser-packages.log`, `summary.json` and `framework-matrix.json`. `git diff --check` also passed.

Independent review identified an existing publication mismatch: clean installation verified pnpm tarballs, while npm publication repacked directories containing `workspace:*`. The workflow now retains and publishes the exact verified tarballs via `POINT_GRAB_RELEASE_DIR`; no directory repacking is used for publication. The duplicate capture alias was also removed from the separate framework workflow. The artifact gate now checks declared export/type/bin file presence in addition to installation. This is not equivalent to runtime import/type-check or installed-client certification.

After these packaging/workflow-only changes, `pnpm run verify:release` passed again for all eight packages with `POINT_GRAB_RELEASE_DIR=/workspace/point-grab-release-evidence/verified-tarballs`. Tarballs and SHA-256 inventory are retained there and in `tarball-manifest.json`; the core MIT notices were confirmed present. Execution log: `artifacts-final.log`. `node --check scripts/verify-release-artifacts.mjs` and `git diff --check` passed. The earlier product/browser gates precede these packaging-only changes; hosted workflow execution remains unrun. Independent follow-up review passed the scoped packaging/workflow fixes with no blockers; it did not establish broader installed-runtime verification.

A non-publishing `npm publish <angular-tarball> --dry-run --ignore-scripts --access public --json` check failed because `@point-grab/angular@0.1.6` is already published (and reported missing npm login). No publish command without `--dry-run` was executed. Choose a new coordinated release version before publication; no successful publish dry-run is claimed.

Outstanding: version decision, deeper packaged/installed-client verification and release approval. Review the final versioned candidate again after any code/version edits and refresh relevant evidence. Other browser engines, nonstandard viewports and universal rendering fidelity remain uncertified.

## Expanded recording — November 18, 2026

The later functional audit fixed additional core interaction/recovery, phone-overlay and history-stacking defects, plus duplicate-name feedback in the Web Components demo. The completed corrected `point-grab-review-2026-11-18-full-r4` run and follow-up root test/lint/build gates passed; details and scope are in [visual review](visual-review.md). Browser counts are not human acceptance. Narrow 360px desktop-Chromium journeys are not touch-device or virtual-keyboard certification.

**The November 17 packaged tarballs predate these product changes and are not the final release artifacts.** Refresh packaging/clean-consumer and installed-client verification after the final version decision. No commit, tag, push or publication is authorized by this evidence.
