# Point-grab V1 Compact Capture Context and Action Menu Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the V1 capture flow concise and fast: compact LLM-ready element references by default, a selected-element action menu, optional review comments, and a persistent toolbar that controls global plugin state.

**Architecture:** Keep the bottom toolbar limited to global capture/session controls. After an element is clicked in capture mode, preserve its selection and show an anchored contextual menu for Copy Element, Copy Styles, Copy HTML, Add to Review, and Cancel. `Add to Review` expands inline with an optional comment and adds a compact reference to the batch prompt. Raw markup stays available only through Copy HTML.

**Tech Stack:** TypeScript, DOM-rendered core UI, Vitest/jsdom, Playwright.

---

### Task 1: Compact default context formatting

**Objective:** Replace default full-HTML/ancestry output with a concise element + parent + source reference.

**Files:**
- Modify: `packages/core/src/clipboard/generate-snippet.ts`
- Modify/test: `packages/core/src/__tests__/generate-snippet.test.ts`

**Requirements:**
- Default output shape: `[<tag.optional-id-or-class> in <parent-tag.optional-id-or-class> (at path:line:column)]`.
- Include component name if available without repeating full ancestry; format source as `Component at path:line:column` when both exist.
- Degrade cleanly if parent/source/component data is unavailable.
- Keep `copyElementHtml()` unchanged: it remains the raw cleaned HTML action.
- Update batch prompt snapshots/assertions for the concise format.

**TDD:** add failing tests for a full source context, a source-less DOM context, and a component-only context; run focused Vitest; implement minimal formatter; rerun.

### Task 2: Capture-time contextual action menu

**Objective:** Show an anchored context menu after selecting an element rather than immediately showing a comment popover.

**Files:**
- Modify/create as appropriate under `packages/core/src/toolbar/`
- Modify: `packages/core/src/grab.ts`
- Modify/test: `packages/core/src/__tests__/...`

**Requirements:**
- Menu appears after capture-mode element selection and retains the target highlight.
- Actions: `Copy Element`, `Copy Styles`, `Copy HTML`, `Add to Review…`, `Cancel`.
- Copy actions execute immediately; cancel returns to active capture mode without copying.
- `Add to Review…` expands inline in the contextual menu, with an optional comment field, `Add to batch`, `Add without comment`, and `Cancel`.
- Comment hard maximum is 500 characters, with visible counter; submit disabled when over the limit.
- Preserve keyboard accessibility and click-outside behavior.

**TDD:** tests for menu actions, target preservation/cancel, comment limits, and adding with/without comment. Run focused tests before and after implementation.

### Task 3: Toolbar simplification and active-mode shortcut hint

**Objective:** Keep bottom toolbar global-only and expose clear capture-mode shortcut guidance.

**Files:**
- Modify: `packages/core/src/toolbar/toolbar-renderer.ts`
- Modify: `packages/core/src/grab.ts`
- Modify/test: `packages/core/src/__tests__/toolbar-renderer.test.ts`

**Requirements:**
- Toolbar controls global state: Capture Mode, Freeze, History, Theme, Enable/Dismiss, and `End & Copy Batch (n/5)` when review items exist.
- Remove per-element action ownership from the toolbar’s ellipsis path; action menu belongs to selected elements.
- Show a prominent active-capture hint above the toolbar including at least Escape/cancel, F/freeze, and click-for-actions guidance.
- Use `maxCaptureCount` dynamically in labels; preserve the public option default of 3 unless explicitly changed in a compatibility-reviewed separate change.

**TDD:** toolbar renderer tests for active hint, count label, and absence of obsolete element-action affordance.

### Task 4: Framework/demo and E2E alignment

**Objective:** Update the canonical demo and test matrix to demonstrate compact review captures and contextual actions.

**Files:**
- Modify: `site/src/components/LiveDemo.astro` and relevant example sources only where required
- Modify: relevant `e2e/*.spec.ts` and helpers

**Requirements:**
- Landing demo is updated after core behavior, not before.
- At least one E2E path covers: capture → Add to Review → comment → second capture → Add without comment → End & Copy Batch.
- At least one E2E path covers Copy Styles and Copy HTML.
- Keep each framework demo’s differentiating proof surface intact (Svelte transient controls, Web Component shadow DOM, Angular nested component, etc.).

### Task 5: Verification and commit

Run, at minimum, using Node 24.15 / pnpm toolchain:

```text
pnpm exec turbo run build
pnpm exec turbo run lint
CI=1 PLAYWRIGHT_RETRIES=0 pnpm exec playwright test
```

Also run `git diff --check` and commit only the V1 capture-context/action-menu changes with a coherent message.
