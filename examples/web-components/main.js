import { initPointGrabWebComponents } from '@point-grab/web-components';

const pointGrab = initPointGrabWebComponents({ activationMode: 'hold', devOnly: false });
pointGrab.showToolbar(); // Show the toolbar on arrival so Actions → Add screenshot is discoverable.

// Every Forge element renders into its own open shadow root, so the page is a
// real tree of nested shadow boundaries: app → service card → badge / button.

const css = String.raw;
const html = String.raw;
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SEED = [
  { id: 'checkout-api', region: 'us-east-1', version: '2.3.1', status: 'healthy', latency: [42, 40, 45, 39, 44, 41, 38, 43, 40, 37, 41, 39] },
  { id: 'search-indexer', region: 'eu-west-1', version: '1.8.0', status: 'degraded', latency: [88, 95, 110, 104, 120, 132, 118, 125, 140, 128, 136, 131] },
  { id: 'image-resizer', region: 'us-west-2', version: '0.9.4', status: 'healthy', latency: [61, 58, 63, 60, 57, 59, 62, 60, 58, 61, 57, 59] },
];
const STEPS = ['Build', 'Test', 'Release'];
const STEP_MS = 900;
const bump = (version) => version.replace(/(\d+)$/, (n) => String(Number(n) + 1));

// --- <forge-badge tone="ok|warn|busy|muted"> ---
class ForgeBadge extends HTMLElement {
  static observedAttributes = ['tone'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        :host { display: inline-flex; }
        span { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font: 600 12px/1.4 system-ui, sans-serif; background: #27211b; color: #d6cbbf; border: 1px solid #3a3129; }
        span::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
        :host([tone='ok']) span { color: #4ade80; background: #12251a; border-color: #1f4029; }
        :host([tone='warn']) span { color: #fbbf24; background: #2a2210; border-color: #4a3b14; }
        :host([tone='busy']) span { color: #60a5fa; background: #111d2e; border-color: #1e3a5f; }
      `}</style><span part="badge"><slot></slot></span>`;
  }
}
customElements.define('forge-badge', ForgeBadge);

// --- <forge-button variant="primary|ghost" disabled> ---
class ForgeButton extends HTMLElement {
  static observedAttributes = ['disabled', 'label'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        :host { display: inline-flex; }
        button { font: 600 13px/1 system-ui, sans-serif; padding: 9px 14px; border-radius: 8px; border: 1px solid #45382b; background: #211b16; color: #f0ebe4; cursor: pointer; transition: background .15s ease, transform .1s ease; }
        button:hover:not(:disabled) { background: #2c241d; }
        button:active:not(:disabled) { transform: translateY(1px); }
        button:focus-visible { outline: 2px solid #fb923c; outline-offset: 2px; }
        button:disabled { opacity: .45; cursor: not-allowed; }
        :host([variant='primary']) button { background: #f97316; border-color: #f97316; color: #1a0f05; }
        :host([variant='primary']) button:hover:not(:disabled) { background: #fb8a3c; }
      `}</style><button part="button" type="button"><slot></slot></button>`;
    this.button = this.shadowRoot.querySelector('button');
  }
  attributeChangedCallback(name, _old, value) {
    if (name === 'disabled') this.button.disabled = value !== null;
    if (name === 'label') this.button.setAttribute('aria-label', value);
  }
}
customElements.define('forge-button', ForgeButton);

// --- <forge-sparkline values="1,2,3"> (2D canvas inside a shadow root) ---
class ForgeSparkline extends HTMLElement {
  static observedAttributes = ['values'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`<style>:host{display:block}canvas{display:block;width:100%;height:36px}</style><canvas width="240" height="36" aria-hidden="true"></canvas>`;
  }
  attributeChangedCallback() { this.draw(); }
  connectedCallback() { this.draw(); }
  draw() {
    const canvas = this.shadowRoot.querySelector('canvas');
    const values = (this.getAttribute('values') ?? '').split(',').map(Number).filter(Number.isFinite);
    const ctx = canvas.getContext('2d');
    if (!ctx || values.length < 2) return;
    const max = Math.max(...values) * 1.1, min = Math.min(...values) * 0.9, w = canvas.width, h = canvas.height;
    const y = (v) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    values.forEach((v, i) => { const x = (i / (values.length - 1)) * w; i ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v)); });
    ctx.strokeStyle = this.getAttribute('color') ?? '#f97316'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = 'rgba(249, 115, 22, 0.08)'; ctx.fill();
  }
}
customElements.define('forge-sparkline', ForgeSparkline);

// --- <forge-service-card service="id"> ---
class ForgeServiceCard extends HTMLElement {
  // Every attribute render() reads, so a rollback's cleared `previous` disables Roll back.
  static observedAttributes = ['status', 'version', 'region', 'latency', 'latency-now', 'previous', 'busy', 'locked'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { if (this.isConnected) this.render(); }
  render() {
    const id = this.getAttribute('service');
    const status = this.getAttribute('status');
    const busy = this.hasAttribute('busy');
    const locked = this.hasAttribute('locked');
    const tone = busy ? 'busy' : status === 'healthy' ? 'ok' : 'warn';
    const label = busy ? 'deploying' : status;
    this.shadowRoot.innerHTML = html`
      <style>${css`
        :host { display: block; }
        article { padding: 18px; border-radius: 14px; background: #1a1714; border: 1px solid #2f2720; transition: border-color .2s ease; }
        :host([busy]) article { border-color: #1e3a5f; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        h3 { margin: 0; font: 600 15px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; color: #f0ebe4; }
        .meta { margin: 6px 0 14px; color: #a89887; font: 13px/1.4 system-ui, sans-serif; }
        .meta b { color: #e7ddd2; font-weight: 600; }
        .latency { display: flex; justify-content: space-between; margin-bottom: 4px; color: #8c7c6c; font: 12px system-ui, sans-serif; }
        footer { display: flex; gap: 8px; margin-top: 14px; }
      `}</style>
      <article>
        <header><h3 class="service-name">${escape(id)}</h3><forge-badge tone="${tone}" data-testid="service-status">${escape(label)}</forge-badge></header>
        <p class="meta">v<b data-testid="service-version">${escape(this.getAttribute('version'))}</b> · ${escape(this.getAttribute('region'))}</p>
        <div class="latency"><span>p95 latency</span><span>${escape(this.getAttribute('latency-now'))} ms</span></div>
        <forge-sparkline values="${escape(this.getAttribute('latency'))}" color="${status === 'healthy' ? '#f97316' : '#fbbf24'}"></forge-sparkline>
        <footer>
          <forge-button variant="primary" class="deploy" label="Deploy ${escape(id)}" ${locked ? 'disabled' : ''}>Deploy</forge-button>
          <forge-button class="rollback" label="Roll back ${escape(id)}" ${locked || !this.getAttribute('previous') ? 'disabled' : ''}>Roll back</forge-button>
        </footer>
      </article>`;
    const emit = (type) => this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: { id } }));
    this.shadowRoot.querySelector('.deploy').addEventListener('click', () => !locked && emit('forge-deploy'));
    this.shadowRoot.querySelector('.rollback').addEventListener('click', () => !locked && emit('forge-rollback'));
  }
}
customElements.define('forge-service-card', ForgeServiceCard);

// --- <forge-pipeline> ---
class ForgePipeline extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        :host { display: block; }
        section { padding: 18px; border-radius: 14px; background: #15120f; border: 1px solid #2f2720; }
        h2 { margin: 0 0 14px; font: 600 13px/1 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #b8a99b; }
        ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        li { padding: 10px; border-radius: 10px; background: #1f1a15; color: #8c7c6c; font: 600 13px system-ui, sans-serif; text-align: center; border: 1px solid transparent; }
        li[data-state='running'] { color: #93c5fd; border-color: #1e3a5f; background: #111d2e; }
        li[data-state='done'] { color: #4ade80; background: #12251a; }
        .log { margin: 14px 0 0; padding: 12px; min-height: 96px; border-radius: 10px; background: #0b0907; color: #c9bba9; font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
        .idle { color: #6f6152; }
      `}</style>
      <section aria-label="Deploy pipeline"><h2>Pipeline</h2><ol>${STEPS.map((s) => `<li data-step="${s}">${s}</li>`).join('')}</ol>
      <pre class="log" data-testid="pipeline-log"><span class="idle">Idle. Deploy a service to start a release.</span></pre></section>`;
  }
  reset() { for (const li of this.shadowRoot.querySelectorAll('li')) li.dataset.state = ''; this.shadowRoot.querySelector('.log').textContent = ''; }
  setStep(index, state) { this.shadowRoot.querySelectorAll('li')[index].dataset.state = state; }
  log(line) { this.shadowRoot.querySelector('.log').textContent += `${line}\n`; }
}
customElements.define('forge-pipeline', ForgePipeline);

// --- <forge-popover> : hover/focus disclosure with slotted content ---
class ForgePopover extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        :host { position: relative; display: inline-block; }
        button { font: 600 13px system-ui, sans-serif; padding: 8px 12px; border-radius: 999px; border: 1px solid #45382b; background: #1a1714; color: #f0ebe4; cursor: default; }
        button:focus-visible { outline: 2px solid #fb923c; outline-offset: 2px; }
        .panel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 5; width: 280px; padding: 14px; border-radius: 12px; background: #211b16; border: 1px solid #45382b; box-shadow: 0 16px 40px rgba(0,0,0,.5); color: #d6cbbf; font: 13px/1.6 system-ui, sans-serif; display: none; }
        :host(:hover) .panel, :host(:focus-within) .panel { display: block; }
      `}</style>
      <button type="button" data-testid="freeze-trigger" aria-describedby="panel"><slot name="label"></slot></button>
      <div class="panel" id="panel" role="tooltip" data-testid="freeze-popover"><slot></slot></div>`;
  }
}
customElements.define('forge-popover', ForgePopover);

// --- <forge-dialog> : new service form (inputs live inside a shadow root) ---
class ForgeDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        .backdrop { position: fixed; inset: 0; z-index: 20; background: rgba(10, 8, 6, .7); display: grid; place-items: center; padding: 16px; }
        form { width: min(420px, 100%); display: grid; gap: 14px; padding: 22px; border-radius: 16px; background: #1a1714; border: 1px solid #45382b; color: #f0ebe4; font: 14px system-ui, sans-serif; }
        h2 { margin: 0; font-size: 17px; }
        label { display: grid; gap: 6px; color: #b8a99b; font-size: 13px; }
        input, select { padding: 10px 12px; border-radius: 8px; border: 1px solid #45382b; background: #0f0d0a; color: #f0ebe4; font: inherit; }
        input:focus, select:focus { outline: 2px solid #fb923c; outline-offset: 1px; }
        .error { margin: -6px 0 0; color: #fca5a5; font-size: 13px; }
        .actions { display: flex; justify-content: flex-end; gap: 8px; }
      `}</style>
      <div class="backdrop">
        <form role="dialog" aria-label="New service" novalidate>
          <h2>New service</h2>
          <label>Service name <input name="name" aria-label="Service name" placeholder="payments-gateway" autocomplete="off" /></label>
          <p class="error" role="alert" hidden>Use lowercase letters, numbers and dashes.</p>
          <label>Region <select name="region" aria-label="Region"><option>us-east-1</option><option>eu-west-1</option><option>ap-south-1</option></select></label>
          <div class="actions"><forge-button class="cancel">Cancel</forge-button><forge-button variant="primary" class="create">Create service</forge-button></div>
        </form>
      </div>`;
    const form = this.shadowRoot.querySelector('form');
    const error = this.shadowRoot.querySelector('.error');
    const submit = () => {
      const name = form.name.value.trim();
      if (!/^[a-z][a-z0-9-]{2,30}$/.test(name)) { error.hidden = false; form.name.focus(); return; }
      this.dispatchEvent(new CustomEvent('forge-create', { bubbles: true, composed: true, detail: { name, region: form.region.value } }));
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    this.shadowRoot.querySelector('.create').addEventListener('click', submit);
    this.shadowRoot.querySelector('.cancel').addEventListener('click', () => this.dispatchEvent(new CustomEvent('forge-cancel', { bubbles: true, composed: true })));
    this.shadowRoot.querySelector('.backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('forge-cancel', { bubbles: true, composed: true })); });
  }
  connectedCallback() { queueMicrotask(() => this.shadowRoot.querySelector('input').focus()); }
}
customElements.define('forge-dialog', ForgeDialog);

// --- <forge-mcp-status> : is Send's destination reachable? ---
class ForgeMcpStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        .chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font: 13px system-ui, sans-serif; color: #d6cbbf; background: #1a1714; border: 1px solid #2f2720; }
        i { width: 8px; height: 8px; border-radius: 50%; background: #8c7c6c; }
        :host([state='online']) i { background: #4ade80; }
        :host([state='offline']) i { background: #f87171; }
        code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #f0ebe4; }
      `}</style><span class="chip" role="status" data-testid="mcp-status"><i aria-hidden="true"></i><span class="text">Checking MCP server…</span></span>`;
  }
  connectedCallback() {
    const check = async () => {
      let online = false;
      try { online = (await fetch('http://localhost:3456/health', { signal: AbortSignal.timeout(1500) })).ok; } catch { /* offline */ }
      this.setAttribute('state', online ? 'online' : 'offline');
      this.shadowRoot.querySelector('.chip').dataset.state = online ? 'online' : 'offline';
      this.shadowRoot.querySelector('.text').innerHTML = online ? 'MCP server connected' : 'MCP server offline · run <code>npx @point-grab/mcp-server</code> to Send';
    };
    check();
    this.timer = setInterval(check, 10000);
    this.onFocus = () => check();
    window.addEventListener('focus', this.onFocus);
  }
  disconnectedCallback() { clearInterval(this.timer); window.removeEventListener('focus', this.onFocus); }
}
customElements.define('forge-mcp-status', ForgeMcpStatus);

// --- <forge-app> : owns state and orchestrates releases ---
class ForgeApp extends HTMLElement {
  constructor() {
    super();
    this.services = structuredClone(SEED).map((s) => ({ ...s, previous: null }));
    this.deploying = null;
    this.attachShadow({ mode: 'open' }).innerHTML = html`
      <style>${css`
        :host { display: block; min-height: 100vh; color: #f0ebe4; font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        * { box-sizing: border-box; }
        .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 28px; border-bottom: 1px solid #2a231d; }
        .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; }
        .spark { display: inline-block; color: #f97316; font-size: 22px; animation: spark 2.4s ease-in-out infinite alternate; }
        @keyframes spark { from { transform: rotate(-18deg) scale(.92); } to { transform: rotate(18deg) scale(1.08); } }
        @media (prefers-reduced-motion: reduce) { .spark { animation: none; } }
        .env { color: #a89887; font-weight: 500; font-size: 13px; }
        main { max-width: 1120px; margin: 0 auto; padding: 32px 28px 64px; }
        .hero { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
        h1 { margin: 0; font-size: clamp(28px, 4vw, 38px); line-height: 1.1; letter-spacing: -.03em; }
        .sub { margin: 6px 0 0; color: #a89887; }
        .summary { display: flex; gap: 10px; align-items: center; color: #a89887; font-size: 14px; }
        .summary b { color: #f0ebe4; font-size: 20px; margin-right: 4px; }
        .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
        .services { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .side { display: grid; gap: 14px; position: sticky; top: 16px; }
        .row { display: flex; justify-content: space-between; align-items: center; margin: 0 0 12px; }
        h2 { margin: 0; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #b8a99b; }
        .notes { margin: 0; padding-left: 18px; }
        .notes li { margin: 4px 0; }
        .guide { margin-top: 32px; padding: 24px; border-radius: 18px; background: #15120f; border: 1px solid #2a231d; }
        .guide-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
        .guide .eyebrow { color: #fb923c; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
        .guide h2 { margin: 6px 0 0; font-size: 20px; letter-spacing: -.01em; text-transform: none; color: #f0ebe4; }
        .guide ol { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; counter-reset: step; }
        .guide li { counter-increment: step; color: #c9bba9; font-size: 14px; }
        .guide li strong { display: block; color: #f0ebe4; margin-bottom: 4px; }
        .guide li strong::before { content: counter(step) ' · '; color: #fb923c; }
        kbd { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid #45382b; color: #f0ebe4; }
        .toast { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); padding: 10px 16px; border-radius: 10px; background: #12251a; color: #bbf7d0; border: 1px solid #1f4029; font-size: 14px; }
        @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
        @media (max-width: 600px) { .top { padding: 14px 16px; flex-wrap: wrap; } main { padding: 24px 16px 48px; } }
      `}</style>
      <header class="top">
        <div class="brand"><span class="spark" data-testid="motion-sample" aria-hidden="true">✦</span> Forge <span class="env">Production</span></div>
        <forge-popover>
          <span slot="label">Release notes</span>
          <strong>What ships next</strong>
          <ul class="notes"><li>Faster cold starts for checkout-api</li><li>Search reindex on schema change</li><li>WebP output for image-resizer</li></ul>
        </forge-popover>
      </header>
      <main>
        <section class="hero">
          <div><h1>Release console</h1><p class="sub">Deploy, watch the pipeline, roll back if something looks off.</p></div>
          <div class="summary" data-testid="release-summary"></div>
        </section>
        <div class="layout">
          <section aria-label="Services">
            <div class="row"><h2>Services</h2><forge-button class="new" label="New service">+ New service</forge-button></div>
            <div class="services"></div>
          </section>
          <aside class="side"><forge-pipeline></forge-pipeline></aside>
        </div>
        <section class="guide" data-testid="playground-guide" aria-labelledby="guide-title">
          <div class="guide-head">
            <div><span class="eyebrow">Web Components playground</span><h2 id="guide-title">Try Point Grab across shadow roots</h2></div>
            <forge-mcp-status></forge-mcp-status>
          </div>
          <ol>
            <li><strong>Grab</strong> Hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd>, hover a service card or its Deploy button and click. You get the element's HTML and its custom-element ancestry through every shadow root.</li>
            <li><strong>Comment</strong> Toolbar <kbd>⋯</kbd> → Add Comment, click an element, write a note. Queue a few, then Confirm &amp; Copy.</li>
            <li><strong>Freeze</strong> Hover <em>Release notes</em>, hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd> and press <kbd>F</kbd>. The popover and the spark hold still. <kbd>Esc</kbd> resumes.</li>
            <li><strong>Screenshot</strong> <kbd>⋯</kbd> → Add screenshot and drag over a card mid-deploy. Shadow DOM and canvas sparklines are captured; inputs are redacted.</li>
            <li><strong>History</strong> The clock button lists every grab. Click one to copy it again.</li>
          </ol>
        </section>
      </main>`;
    const root = this.shadowRoot;
    this.list = root.querySelector('.services');
    this.pipeline = root.querySelector('forge-pipeline');
    root.querySelector('.new').addEventListener('click', () => this.openDialog());
    this.addEventListener('forge-deploy', (e) => this.deploy(e.detail.id));
    this.addEventListener('forge-rollback', (e) => this.rollback(e.detail.id));
    this.addEventListener('forge-create', (e) => this.create(e.detail));
    this.addEventListener('forge-cancel', () => this.closeDialog());
    this.render();
  }

  render() {
    const cards = new Map([...this.list.children].map((el) => [el.getAttribute('service'), el]));
    for (const s of this.services) {
      let card = cards.get(s.id);
      if (!card) { card = document.createElement('forge-service-card'); card.setAttribute('service', s.id); this.list.append(card); }
      const attrs = { region: s.region, version: s.version, status: s.status, latency: s.latency.join(','), 'latency-now': s.latency.at(-1), previous: s.previous ?? '' };
      for (const [k, v] of Object.entries(attrs)) if (card.getAttribute(k) !== String(v)) card.setAttribute(k, v);
      card.toggleAttribute('busy', this.deploying === s.id);
      card.toggleAttribute('locked', this.deploying !== null);
    }
    const healthy = this.services.filter((s) => s.status === 'healthy').length;
    this.shadowRoot.querySelector('.summary').innerHTML = `<span><b data-testid="healthy-count">${healthy}</b>healthy</span><span>·</span><span><b>${this.services.length}</b>services</span>`;
  }

  deploy(id) {
    if (this.deploying) return;
    const service = this.services.find((s) => s.id === id);
    const target = bump(service.version);
    this.deploying = id;
    this.render();
    this.pipeline.reset();
    this.pipeline.log(`$ forge deploy ${id}@${target}`);
    STEPS.forEach((step, i) => {
      setTimeout(() => { this.pipeline.setStep(i, 'running'); this.pipeline.log(`→ ${step}…`); }, i * STEP_MS);
      setTimeout(() => { this.pipeline.setStep(i, 'done'); }, (i + 1) * STEP_MS - 80);
    });
    setTimeout(() => {
      service.previous = service.version;
      service.version = target;
      service.status = 'healthy';
      service.latency = [...service.latency.slice(1), Math.round(service.latency.at(-1) * 0.7)];
      this.deploying = null;
      this.pipeline.log(`✓ ${id} v${target} is live`);
      this.render();
      this.toast(`${id} v${target} is live`);
    }, STEPS.length * STEP_MS);
  }

  rollback(id) {
    const service = this.services.find((s) => s.id === id);
    if (!service.previous || this.deploying) return;
    this.pipeline.reset();
    this.pipeline.log(`$ forge rollback ${id}\n↩ v${service.version} → v${service.previous}`);
    [service.version, service.previous] = [service.previous, null];
    this.render();
    this.toast(`${id} rolled back to v${service.version}`);
  }

  openDialog() {
    if (this.shadowRoot.querySelector('forge-dialog')) return;
    this.shadowRoot.append(document.createElement('forge-dialog'));
  }
  closeDialog() { this.shadowRoot.querySelector('forge-dialog')?.remove(); }
  create({ name, region }) {
    if (!this.services.some((s) => s.id === name)) {
      this.services.push({ id: name, region, version: '0.1.0', status: 'healthy', latency: [50, 52, 49, 51, 50, 48, 50, 49, 51, 50, 49, 50], previous: null });
    }
    this.closeDialog();
    this.render();
    this.toast(`${name} created in ${region}`);
  }

  toast(message) {
    this.shadowRoot.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.dataset.testid = 'forge-toast'; el.textContent = message;
    this.shadowRoot.append(el);
    setTimeout(() => el.remove(), 3200);
  }
}
customElements.define('forge-app', ForgeApp);
