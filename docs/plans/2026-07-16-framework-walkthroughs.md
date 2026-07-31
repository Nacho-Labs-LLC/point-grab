# Framework Capture-Session Walkthroughs Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make every Point-grab framework demo teach and prove the same real capture-session workflow: start capture mode, annotate multiple targets, skip when appropriate, and end with an AI-ready prompt.

**Architecture:** Keep the product behavior in `@point-grab/core`; each demo owns only presentation-level walkthrough state and framework-specific target highlights. The walkthrough must observe real Point-grab capture-session behavior rather than simulate clipboard output or AI responses. Every demo must use the new default toggle model (`Cmd+Shift+C` / `Ctrl+Shift+C`) and the visible bottom `Capture mode` affordance.

**Tech Stack:** TypeScript/JavaScript, Angular, React, Vue, Svelte, Web Components, Vanilla JS, Vitest, Playwright, Docker Compose.

---

## Shared UX contract

Every demo uses the same language and sequence:

1. **Start Capture Mode** — use the bottom `Capture mode` affordance or `Cmd/Ctrl+Shift+C`.
2. **Capture a target** — click a highlighted real element, write a concrete comment, and click **Accept**.
3. **Continue or Skip** — show that capture mode stays active and the toolbar count grows; one demo step should make Skip explicit.
4. **End Capture Mode** — use the persistent toolbar action and show a completion panel containing the **actual generated review prompt**, not a simulated chat reply. Include a `Copy prompt` action and a compact “Paste this into your AI agent” affordance.

**Prompt visibility rule:** the individual technology demos must render the exact aggregate text written to the clipboard after every accepted comment. Do not require users to paste from the clipboard merely to see what Point-grab produced; clipboard-read permissions and browser behavior make that a fragile proof mechanism. A voluntary paste-back verifier may be added as a secondary interaction, never as the primary showcase.

Do not use obsolete labels (`hold`, `Add to Review`, `Confirm & Copy`) or claim that capture happens only once at session end. The aggregate prompt is updated after every accepted comment and preserved at end.

---

### Task 1: Normalize demo initialization and visible shortcut guidance

**Objective:** Remove demo-level hold-mode overrides so every demo exercises core’s real capture-session defaults.

**Files:**
- Modify: `examples/vanilla/main.js`
- Modify: `examples/react/src/App.jsx`
- Modify: `examples/vue/src/main.js`
- Modify: `examples/svelte/src/App.svelte`
- Modify: `examples/angular/src/main.ts`
- Modify: `examples/web-components/main.js`
- Modify: any visible demo hints that say `Cmd+C`, `Ctrl+C`, or `hold`.

**Step 1: Write failing tests**
- Add static/source assertions or focused E2E assertions that demo copy includes `Cmd+Shift+C` / `Ctrl+Shift+C` and no demo initializes Point-grab with `activationMode: 'hold'`.

**Step 2: Verify RED**

```bash
docker compose run --rm install pnpm test
```

Expected: demo/default shortcut assertions fail against the existing hold-mode options.

**Step 3: Implement**
- Remove `activationMode: 'hold'`; retain `devOnly: false` only where the demo needs it.
- Use the exact phrasing: `Start Capture Mode with Cmd+Shift+C / Ctrl+Shift+C, or click Capture mode below.`

**Step 4: Verify GREEN**

```bash
docker compose run --rm install pnpm build
```

**Step 5: Commit**

```bash
git add examples
git commit -m "feat(demos): adopt capture-mode defaults"
```

### Task 2: Add reusable walkthrough copy and presentation rules

**Objective:** Establish consistent step labels, target highlight treatment, and completion wording without introducing a cross-framework UI package.

**Files:**
- Create: `docs/demo-walkthrough-contract.md`
- Modify: each framework demo’s primary app component/source.

**Step 1: Write failing behavior tests**
- Each demo’s E2E spec must expose an initial `Step 1 of 3` or equivalent review-session instruction and a visible completion state after the session ends.

**Step 2: Implement the minimal presentation contract**
- Use three dots or equivalent compact progress.
- Use one highlighted target at a time.
- Use a completion panel: `N reviewed elements + comments are ready for your AI agent.`
- Do not fabricate source paths, generated prompts, or AI responses in the walkthrough.

**Step 3: Verify each demo build**

```bash
docker compose run --rm install pnpm --filter point-grab-example-vanilla build
docker compose run --rm install pnpm --filter point-grab-example-react build
docker compose run --rm install pnpm --filter point-grab-example-vue build
docker compose run --rm install pnpm --filter point-grab-example-svelte build
docker compose run --rm install pnpm --filter point-grab-example-angular build
docker compose run --rm install pnpm --filter point-grab-example-web-components build
```

### Task 3: Implement Vanilla walkthrough — freeze/moving UI proof

**Files:**
- Modify: `examples/vanilla/index.html`
- Modify: `examples/vanilla/main.js`
- Modify: `examples/vanilla/style.css`
- Modify: `e2e/vanilla.spec.ts`

**Targets:** static queue item → animated progress track (Freeze) → volume popover.

**TDD acceptance:** start capture through the visible affordance, Accept one comment, Skip a second selection, Accept a third selection, then end the session. Assert clipboard contains two ordered annotated elements and the completion panel is visible.

### Task 4: Implement React walkthrough — conditional UI proof

**Files:**
- Modify: `examples/react/src/App.jsx`
- Modify: `examples/react/src/*.css` or existing style location
- Modify: `e2e/react.spec.ts`

**Targets:** post action row → opened reply composer.

**TDD acceptance:** React hook remains mounted through conditional reply UI; clipboard captures the component/source context for both accepted comments.

### Task 5: Implement Vue walkthrough — reactive cart proof

**Files:**
- Modify: `examples/vue/src/App.vue`
- Modify: `examples/vue/src/main.js`
- Modify: `e2e/vue.spec.ts`

**Targets:** validation-sensitive Add to Cart action → cart drawer total after a reactive cart update.

**TDD acceptance:** completion state only appears after real comments are accepted across both reactive DOM states.

### Task 6: Implement Svelte walkthrough — action boundary proof

**Files:**
- Modify: `examples/svelte/src/App.svelte`
- Modify: `e2e/svelte.spec.ts`

**Targets:** selected-note title/editor → conditionally visible formatting controls.

**TDD acceptance:** the Svelte action stays active across state updates and produces an ordered two-item capture prompt.

### Task 7: Implement Angular walkthrough — component metadata proof

**Files:**
- Modify: `examples/angular/src/app/app.*`
- Modify: `examples/angular/src/main.ts`
- Modify: `e2e/angular.spec.ts`

**Targets:** `PostCardComponent` content → expanded detail panel.

**TDD acceptance:** test confirms the real Angular component metadata appears in the captured context and the walkthrough completion state follows End Capture Mode.

### Task 8: Implement Web Components walkthrough — Shadow DOM proof

**Files:**
- Modify: `examples/web-components/main.js`
- Modify: `examples/web-components/style.css` if present
- Modify: `e2e/web-components.spec.ts`

**Targets:** nested custom-element control → tooltip/shadow-content target.

**TDD acceptance:** selection crosses Shadow DOM and the session prompt preserves both accepted comments in order.

### Task 9: Align marketing LiveDemo with the real session language

**Files:**
- Modify: `site/src/components/LiveDemo.astro`
- Modify: `e2e/site-livedemo.spec.ts`

**Objective:** update stale `hold`, `Add Comment`, and `Confirm & Copy` copy. Keep its existing visual narrative but explicitly identify it as a product walkthrough; do not imply it is an independently persisted production review system.

### Task 10: Full certification and review

**Commands:**

```bash
docker compose run --rm install pnpm build
docker compose run --rm install pnpm lint
docker compose run --rm install pnpm test
docker compose run --rm install pnpm test:e2e
docker compose run --rm install pnpm verify:release
```

**Manual verification:** open each local demo, use either capture affordance or shortcut, accept two comments, use Skip once, and inspect the clipboard before and after End Capture Mode.

**Commit:**

```bash
git add examples site e2e docs
git commit -m "feat(demos): add guided capture-session walkthroughs"
```
