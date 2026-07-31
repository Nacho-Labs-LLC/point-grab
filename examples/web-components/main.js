import { initPointGrabWebComponents } from '@point-grab/web-components';

const pointGrab = initPointGrabWebComponents({ devOnly: false });

// --- <forge-app> ---
class ForgeApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100vh;
          background: #0f0d0a;
          color: #d4cdc5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .forge-header {
          background: #1a1714;
          border-bottom: 1px solid #2e2924;
          padding: 0 1.5rem;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .forge-header-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .forge-header-logo svg {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .forge-header-wordmark {
          font-size: 1rem;
          font-weight: 700;
          color: #f0ebe4;
          letter-spacing: -0.02em;
        }

        .forge-header-hint {
          font-size: 0.75rem;
          color: #5a5248;
        }

        .forge-main {
          max-width: 640px;
          margin: 0 auto;
          padding: 2.5rem 1.5rem 4rem;
        }

        .forge-section {
          margin-bottom: 2.5rem;
        }

        .forge-section-heading {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #5a5248;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #2e2924;
        }

        .forge-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .forge-tooltip-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .forge-hint {
          font-size: 0.75rem;
          color: #5a5248;
          margin-top: 0.5rem;
        }
        .walkthrough { margin: 1.5rem auto 0; max-width: 640px; border: 1px solid rgba(249,115,22,.5); border-radius: .75rem; padding: 1rem; background: rgba(249,115,22,.06); }
        .walkthrough-progress { display: flex; gap: .35rem; margin-bottom: .55rem; }.walkthrough-progress span { width: 28px; height: 4px; border-radius: 9px; background: #2e2924; }.walkthrough-progress .is-active { background: #f97316; }
        .walkthrough-step { color: #fb923c; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }.walkthrough-title { color: #f0ebe4; font-size: 1rem; margin: .25rem 0; }.walkthrough-copy { color: #8a8078; font-size: .8rem; line-height: 1.45; }
        .prompt-preview { display: block; max-height: 120px; overflow: auto; white-space: pre-wrap; margin-top: .75rem; padding: .6rem; background: #0f0d0a; border: 1px solid #2e2924; border-radius: .4rem; color: #fdba74; font: .7rem/1.45 ui-monospace, monospace; }.walkthrough-complete { margin-top: .75rem; padding-top: .75rem; border-top: 1px solid #2e2924; color: #86efac; font-size: .82rem; }.walkthrough-complete p { color: #8a8078; }.copy-prompt { margin-top: .5rem; border: 0; border-radius: .35rem; background: #f97316; color: #0f0d0a; font-weight: 700; padding: .4rem .6rem; cursor: pointer; }
        .walkthrough-target { outline: 2px solid #fdba74; outline-offset: 4px; animation: walkthrough-pulse 1.5s ease-in-out infinite; } @keyframes walkthrough-pulse { 50% { outline-color: #fff7ed; } }
      </style>

      <header class="forge-header">
        <div class="forge-header-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="16" width="18" height="5" rx="1.5" fill="#f97316"/>
            <rect x="9" y="11" width="6" height="6" rx="1" fill="#f97316" opacity="0.7"/>
            <path d="M12 3 L15 8 L12 11 L9 8 Z" fill="#f0ebe4"/>
            <rect x="11" y="7" width="2" height="4" rx="0.5" fill="#f97316"/>
          </svg>
          <span class="forge-header-wordmark">Forge UI</span>
        </div>
        <span class="forge-header-hint">Start Capture Mode with Cmd+Shift+C / Ctrl+Shift+C, or click Capture mode below.</span>
      </header>

      <section class="walkthrough" aria-live="polite">
        <div class="walkthrough-progress"><span class="is-active"></span><span></span><span></span></div>
        <p class="walkthrough-step">Step 1 of 3</p><h1 class="walkthrough-title">Capture a nested custom-element control</h1>
        <p class="walkthrough-copy">Click Capture mode below, then select the highlighted Deploy control and choose Accept.</p>
        <pre class="prompt-preview" data-testid="prompt-preview">Your accepted review comments will appear here.</pre>
        <div class="walkthrough-complete" hidden><strong></strong><p>Paste this into your AI agent, or copy the exact aggregate prompt.</p><button type="button" class="copy-prompt">Copy prompt</button></div>
      </section>

      <main class="forge-main">

        <section class="forge-section">
          <div class="forge-section-heading">Buttons</div>
          <div class="forge-row">
            <forge-button variant="primary">Deploy</forge-button>
            <forge-button variant="secondary">Settings</forge-button>
            <forge-button variant="ghost">Cancel</forge-button>
          </div>
        </section>

        <section class="forge-section">
          <div class="forge-section-heading">Badges</div>
          <div class="forge-row">
            <forge-badge count="3" variant="default"></forge-badge>
            <forge-badge count="0" variant="success" auto-increment></forge-badge>
            <forge-badge count="12" variant="warning"></forge-badge>
            <forge-badge count="99" variant="danger"></forge-badge>
          </div>
          <div class="forge-hint">The green badge auto-increments every 3s</div>
        </section>

        <section class="forge-section">
          <div class="forge-section-heading">Input</div>
          <forge-input label="Component name" placeholder="e.g. forge-dialog"></forge-input>
        </section>

        <section class="forge-section">
          <div class="forge-section-heading">Tooltip</div>
          <div class="forge-tooltip-row">
            <forge-tooltip text="Send a message" position="top">
              <forge-button variant="primary">Message</forge-button>
            </forge-tooltip>
            <forge-tooltip text="Opens in new tab" position="top">
              <forge-button variant="ghost">Docs</forge-button>
            </forge-tooltip>
          </div>
          <div class="forge-hint">Hover a button — press F to freeze the tooltip for capture</div>
        </section>

        <section class="forge-section">
          <div class="forge-section-heading">Card</div>
          <forge-card heading="Component Health">
            All systems operational. Last deploy 4 minutes ago.
            <forge-badge count="2" variant="success" style="margin-top: 0.75rem; display: block;"></forge-badge>
          </forge-card>
        </section>

      </main>
    `;
  }
}
customElements.define('forge-app', ForgeApp);

// --- <forge-button> ---
class ForgeButton extends HTMLElement {
  static get observedAttributes() {
    return ['variant'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const variant = this.getAttribute('variant') || 'primary';

    const styles = {
      primary: `
        background: #f97316;
        color: #0f0d0a;
        border: 1px solid transparent;
      `,
      secondary: `
        background: #1a1714;
        color: #d4cdc5;
        border: 1px solid #2e2924;
      `,
      ghost: `
        background: transparent;
        color: #f97316;
        border: 1px solid transparent;
      `,
    };

    const hoverStyles = {
      primary: `background: #ea6a0a;`,
      secondary: `background: #231f1b; border-color: #3e3530;`,
      ghost: `background: rgba(249,115,22,0.08);`,
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        .forge-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.4375rem 0.875rem;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          line-height: 1.4;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
          ${styles[variant] || styles.primary}
        }
        .forge-btn:hover {
          ${hoverStyles[variant] || hoverStyles.primary}
        }
        .forge-btn:active {
          opacity: 0.85;
        }
      </style>
      <button class="forge-btn"><slot></slot></button>
    `;
  }
}
customElements.define('forge-button', ForgeButton);

// --- <forge-badge> ---
class ForgeBadge extends HTMLElement {
  static get observedAttributes() {
    return ['count', 'variant', 'auto-increment'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._interval = null;
  }

  connectedCallback() {
    this.render();
    if (this.hasAttribute('auto-increment')) {
      this._interval = setInterval(() => {
        const current = parseInt(this.getAttribute('count') || '0', 10);
        this.setAttribute('count', String(current + 1));
        this._triggerBump();
      }, 3000);
    }
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  attributeChangedCallback(name) {
    if (name === 'count') {
      const chip = this.shadowRoot.querySelector('.badge-chip');
      const countEl = this.shadowRoot.querySelector('.badge-count');
      if (countEl) {
        countEl.textContent = this.getAttribute('count') || '0';
      }
    } else {
      this.render();
    }
  }

  _triggerBump() {
    const chip = this.shadowRoot.querySelector('.badge-chip');
    if (!chip) return;
    chip.classList.remove('badge-bump');
    // Force reflow so re-adding the class re-triggers animation
    void chip.offsetWidth;
    chip.classList.add('badge-bump');
    chip.addEventListener('animationend', () => {
      chip.classList.remove('badge-bump');
    }, { once: true });
  }

  render() {
    const variant = this.getAttribute('variant') || 'default';
    const count = this.getAttribute('count') || '0';

    const colors = {
      default: { bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.25)' },
      success: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.25)' },
      warning: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
      danger:  { bg: 'rgba(248,113,113,0.12)', text: '#f87171', border: 'rgba(248,113,113,0.25)' },
    };

    const c = colors[variant] || colors.default;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        .badge-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          background: ${c.bg};
          border: 1px solid ${c.border};
          font-size: 0.75rem;
          font-weight: 600;
          color: ${c.text};
          font-variant-numeric: tabular-nums;
          transition: transform 0.1s;
        }
        .badge-label {
          font-size: 0.6875rem;
          opacity: 0.8;
          font-weight: 500;
        }
        .badge-count {
          font-size: 0.75rem;
        }
        @keyframes badge-bump-anim {
          0%   { transform: scale(1); }
          45%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        .badge-bump {
          animation: badge-bump-anim 0.35s ease;
        }
      </style>
      <div class="badge-chip">
        <span class="badge-count">${count}</span>
      </div>
    `;
  }
}
customElements.define('forge-badge', ForgeBadge);

// --- <forge-input> ---
class ForgeInput extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'placeholder', 'value'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const label = this.getAttribute('label') || '';
    const placeholder = this.getAttribute('placeholder') || '';
    const value = this.getAttribute('value') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .input-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #8a8078;
          margin-bottom: 0.375rem;
          letter-spacing: 0.01em;
        }
        .input-field {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #1a1714;
          border: 1px solid #2e2924;
          border-radius: 0.375rem;
          color: #d4cdc5;
          font-size: 0.875rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          max-width: 320px;
        }
        .input-field::placeholder {
          color: #5a5248;
        }
        .input-field:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 2px rgba(249,115,22,0.15);
        }
      </style>
      <label class="input-label">${label}</label>
      <input class="input-field" placeholder="${placeholder}" value="${value}" />
    `;
  }
}
customElements.define('forge-input', ForgeInput);

// --- <forge-tooltip> ---
class ForgeTooltip extends HTMLElement {
  static get observedAttributes() {
    return ['text', 'position'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onMouseover = this._onMouseover.bind(this);
    this._onMouseleave = this._onMouseleave.bind(this);
  }

  connectedCallback() {
    this.render();
    this.addEventListener('mouseover', this._onMouseover);
    this.addEventListener('mouseleave', this._onMouseleave);
  }

  disconnectedCallback() {
    this.removeEventListener('mouseover', this._onMouseover);
    this.removeEventListener('mouseleave', this._onMouseleave);
  }

  attributeChangedCallback() {
    this.render();
  }

  _onMouseover() {
    const bubble = this.shadowRoot.querySelector('.tooltip-bubble');
    if (bubble) {
      bubble.style.opacity = '1';
      bubble.style.visibility = 'visible';
    }
  }

  _onMouseleave() {
    const bubble = this.shadowRoot.querySelector('.tooltip-bubble');
    if (bubble) {
      bubble.style.opacity = '0';
      bubble.style.visibility = 'hidden';
    }
  }

  render() {
    const text = this.getAttribute('text') || '';
    const position = this.getAttribute('position') || 'top';

    const isTop = position === 'top';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          position: relative;
        }
        .tooltip-wrapper {
          display: inline-block;
          position: relative;
        }
        .tooltip-bubble {
          position: absolute;
          ${isTop ? 'bottom: calc(100% + 8px);' : 'top: calc(100% + 8px);'}
          left: 50%;
          transform: translateX(-50%);
          background: #231f1b;
          border: 1px solid #2e2924;
          border-radius: 0.375rem;
          padding: 0.375rem 0.625rem;
          font-size: 0.75rem;
          color: #d4cdc5;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          z-index: 100;
        }
        .tooltip-bubble::after {
          content: '';
          position: absolute;
          ${isTop ? 'top: 100%;' : 'bottom: 100%;'}
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          ${isTop
            ? 'border-top-color: #2e2924;'
            : 'border-bottom-color: #2e2924;'}
        }
      </style>
      <div class="tooltip-wrapper">
        <slot></slot>
        <div class="tooltip-bubble">${text}</div>
      </div>
    `;
  }
}
customElements.define('forge-tooltip', ForgeTooltip);

// --- <forge-card> ---
class ForgeCard extends HTMLElement {
  static get observedAttributes() {
    return ['heading'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const heading = this.getAttribute('heading') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card-root {
          background: #1a1714;
          border: 1px solid #2e2924;
          border-radius: 0.625rem;
          padding: 1.25rem 1.375rem;
        }
        .card-heading {
          font-size: 0.875rem;
          font-weight: 600;
          color: #f0ebe4;
          margin-bottom: 0.625rem;
        }
        .card-body {
          font-size: 0.8125rem;
          color: #8a8078;
          line-height: 1.6;
        }
      </style>
      <div class="card-root">
        <div class="card-heading">${heading}</div>
        <div class="card-body"><slot></slot></div>
      </div>
    `;
  }
}
customElements.define('forge-card', ForgeCard);

// Assemble the visible aggregate from the same capture-session snippets Point-grab copies.
const forgeApp = document.querySelector('forge-app');
const walkthroughRoot = forgeApp.shadowRoot;
const walkthrough = walkthroughRoot.querySelector('.walkthrough');
const walkthroughStep = walkthrough.querySelector('.walkthrough-step');
const walkthroughTitle = walkthrough.querySelector('.walkthrough-title');
const walkthroughCopy = walkthrough.querySelector('.walkthrough-copy');
const walkthroughDots = [...walkthrough.querySelectorAll('.walkthrough-progress span')];
const promptPreview = walkthrough.querySelector('[data-testid="prompt-preview"]');
const completion = walkthrough.querySelector('.walkthrough-complete');
const completionTitle = completion.querySelector('strong');
const copyPromptButton = completion.querySelector('.copy-prompt');
const annotations = [];
let walkthroughStage = 1;
const stages = {
  1: ['Capture a nested custom-element control', 'Select the highlighted Deploy control, add a comment in the dialog, and choose Accept.', () => walkthroughRoot.querySelector('forge-button')],
  2: ['Skip a live Shadow DOM badge', 'Select the highlighted auto-incrementing badge, then choose Skip to keep the session active.', () => walkthroughRoot.querySelector('forge-badge[variant="success"]')],
  3: ['Capture tooltip shadow content', 'The Message tooltip is visible. Select it, add your second comment, and choose Accept.', () => walkthroughRoot.querySelector('forge-tooltip')],
};
function renderPromptPreview() { promptPreview.textContent = annotations.length ? annotations.map(({ snippet, comment }, index) => `## Element ${index + 1}\n${snippet}\n\nComment: ${comment}`).join('\n\n---\n\n') : 'Your accepted review comments will appear here.'; }
function renderWalkthrough() {
  walkthroughRoot.querySelectorAll('.walkthrough-target').forEach((element) => element.classList.remove('walkthrough-target'));
  const [title, copy, target] = stages[walkthroughStage]; walkthroughStep.textContent = `Step ${walkthroughStage} of 3`; walkthroughTitle.textContent = title; walkthroughCopy.textContent = copy;
  walkthroughDots.forEach((dot, index) => dot.classList.toggle('is-active', index < walkthroughStage)); target()?.classList.add('walkthrough-target');
}
function showCompletion() { if (!annotations.length) return; completionTitle.textContent = `${annotations.length} reviewed element${annotations.length === 1 ? '' : 's'} + comments are ready for your AI agent.`; completion.hidden = false; walkthroughRoot.querySelectorAll('.walkthrough-target').forEach((element) => element.classList.remove('walkthrough-target')); }
pointGrab.registerPlugin({ name: 'web-components-walkthrough-preview', hooks: { onCopySuccess(snippet, _context, comment) {
  if (!comment || annotations.some((annotation) => annotation.snippet === snippet && annotation.comment === comment)) return;
  annotations.push({ snippet, comment }); renderPromptPreview(); if (annotations.length === 1) { walkthroughStage = 2; renderWalkthrough(); }
} } });
window.addEventListener('point-grab:capture-session', (event) => {
  const { action } = event.detail || {};
  if (action === 'skipped' && walkthroughStage === 2) {
    walkthroughStage = 3;
    const tooltip = walkthroughRoot.querySelector('forge-tooltip');
    tooltip.shadowRoot.querySelector('.tooltip-bubble').style.cssText = 'opacity: 1; visibility: visible;';
    renderWalkthrough();
  }
  if (action === 'ended') showCompletion();
});
copyPromptButton.addEventListener('click', async () => { await navigator.clipboard.writeText(promptPreview.textContent || ''); copyPromptButton.textContent = 'Copied prompt'; });
renderWalkthrough();
