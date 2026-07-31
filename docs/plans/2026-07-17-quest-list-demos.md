# Quest-List Demo Surface Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace forced linear walkthroughs with independent, event-backed quest lists that let users explore Point-grab’s real capture-session features in any order.

**Architecture:** Core publishes a richer capture-session event with target identity and an annotation snapshot. Each demo keeps a local quest-status map, renders non-clickable status rows, and marks a quest complete only from the core event. The real aggregate prompt remains the source of truth; no fake chat, ordered tutorial gate, or clipboard-read inference.

**Tech stack:** TypeScript/JavaScript, React, Vue, Svelte, Angular, Web Components, Astro, Vitest, Playwright, Docker Compose.

---

## Shared quest contract

Every demo presents a compact, always-visible **Quest list** rather than `Step N of 3`:

- Comment one meaningful target → `Added to the live aggregate prompt`
- Skip a meaningful target → `Skipped; Capture Mode stayed active`
- Comment a second target → second prompt section / marker
- End Capture Mode → `Aggregate prompt copied; ready to paste`

Quest rows are display-only (`role="checkbox"`, `aria-checked`) and may be completed in any order. All pending quest targets use subtle independent `.quest-target` emphasis; no target is locked or auto-revealed by another quest.

## Task 1: Expand core capture-session event detail

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/grab.ts`
- Test: `packages/core/src/__tests__/capture-session.test.ts` or a focused DOM/event test

**RED:** Write a test asserting `point-grab:capture-session` contains action, annotation count, selected target context when relevant, and a read-only annotation snapshot for `accepted`, `skipped`, `updated`, and `ended`.

**GREEN:** Export `CaptureSessionAction` and `CaptureSessionEventDetail`; emit target context plus snapshot. Preserve the existing `action` and `annotationCount` fields for compatibility.

**Verify:**
```bash
docker compose run --rm install pnpm --filter @point-grab/core test
docker compose run --rm install pnpm --filter @point-grab/core build
```

## Task 2: Replace Vanilla walkthrough with a quest list

**Files:**
- Modify: `examples/vanilla/index.html`
- Modify: `examples/vanilla/main.js`
- Modify: `examples/vanilla/style.css`
- Test: `e2e/vanilla.spec.ts`

**Quests:** comment queue item; skip animated progress; comment volume popover; end with two annotations.

**RED:** Assert every quest begins pending, Skip can complete before comment quests, only the matching row changes, and end checks only the final quest.

**GREEN:** Replace `walkthroughStage`, dots, sequential target rendering, and completion card with a local quest map driven by enriched core events. Render preview from event annotation snapshot / canonical prompt, not append-only plugin state.

## Task 3: Port the shared model to React and Vue

**Files:**
- Modify: `examples/react/src/App.jsx`, `examples/react/src/App.css`, `e2e/react.spec.ts`
- Modify: `examples/vue/src/App.vue`, `e2e/vue.spec.ts`

**Proof targets:** React post action / reply composer; Vue Add to Cart / reactive cart total.

**RED/GREEN:** Replace counter/step state with a quest map. Keep natural prerequisites user-driven: the reply composer and cart state are normal app interactions, not forced tour mutations.

## Task 4: Port the shared model to Svelte and Angular

**Files:**
- Modify: `examples/svelte/src/App.svelte`, `examples/svelte/src/app.css`, `e2e/svelte.spec.ts`
- Modify: `examples/angular/src/app/app.ts`, `app.html`, `app.css`, `e2e/angular.spec.ts`

**Proof targets:** Svelte title/body/tags; Angular metric/post/operator note.

**RED/GREEN:** Remove walkthrough-start, clipboard-read synchronization, deactivation timers, and linear target flags. Drive quests solely from core events and snapshot state.

## Task 5: Port the shared model to Web Components

**Files:**
- Modify: `examples/web-components/main.js`
- Modify: `e2e/web-components.spec.ts`

**Proof targets:** nested Deploy custom element, live badge skip, tooltip content comment.

**RED/GREEN:** Render quest list within `forge-app`’s shadow root; keep tooltip discovery user-driven and preserve Shadow DOM proof.

## Task 6: Replace marketing LiveDemo’s stages with independent quests

**Files:**
- Modify: `site/src/components/LiveDemo.astro`
- Modify: `e2e/site-livedemo.spec.ts`

**Quests:** Revenue comment, Fulfillment skip, notification comment, end review. Add optional marker-review quest after first accepted annotation.

**RED/GREEN:** Remove stage title/dots/single target. Add `data-testid="quest-list"`, stable `data-quest-id`, `data-quest-status`, prompt preview, and truthful partial-completion end state. Verify a non-linear order, Skip preserving prompt/count, exact clipboard equality, and marker edit/delete refresh.

## Task 7: Serialized certification

Run one project at a time, using the capped Docker E2E service only:

```bash
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project vanilla --retries=0
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project react --retries=0
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project vue --retries=0
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project svelte --retries=0
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project angular --retries=0
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project web-components --retries=0
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project site-livedemo --retries=0
```

Then run affected framework/site production builds. Do not launch framework demo servers concurrently for manual review.
