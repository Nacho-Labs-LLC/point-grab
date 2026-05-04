import { initPointGrabWebComponents } from '@point-grab/web-components';

initPointGrabWebComponents({ activationMode: 'hold' });

// --- <app-shell> ---
class AppShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        header {
          margin-bottom: 2rem;
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fafafa;
          margin-bottom: 0.25rem;
        }
        p {
          color: #a1a1aa;
          font-size: 0.875rem;
          line-height: 1.5;
        }
        .dashboard {
          display: grid;
          gap: 1rem;
        }
        .stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .stat-row {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <header>
        <h1>point-grab web-components</h1>
        <p>Hold Cmd+C (Mac) or Ctrl+C (Win) and hover over any element. Click to capture. Press F to freeze animations.</p>
      </header>
      <div class="dashboard">
        <div class="stat-row">
          <stat-card label="Revenue" value="$48.2k" change="+12.5%"></stat-card>
          <stat-card label="Orders" value="1,284" change="+8.1%"></stat-card>
          <stat-card label="Customers" value="573" change="+3.2%"></stat-card>
        </div>
        <progress-card></progress-card>
        <order-table></order-table>
        <notif-popover></notif-popover>
        <skeleton-card></skeleton-card>
      </div>
    `;
  }
}
customElements.define('app-shell', AppShell);

// --- <stat-card> ---
class StatCard extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'value', 'change'];
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
    const value = this.getAttribute('value') || '';
    const change = this.getAttribute('change') || '';
    const isPositive = change.startsWith('+');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background: #141416;
          border: 1px solid #27272a;
          border-radius: 0.75rem;
          padding: 1.25rem;
        }
        .label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #a1a1aa;
          margin-bottom: 0.5rem;
        }
        .value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fafafa;
          margin-bottom: 0.25rem;
        }
        .change {
          font-size: 0.8125rem;
          color: ${isPositive ? '#22c55e' : '#ef4444'};
        }
      </style>
      <div class="card">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
        <div class="change">${change}</div>
      </div>
    `;
  }
}
customElements.define('stat-card', StatCard);

// --- <progress-card> ---
class ProgressCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._progress = 0;
    this._interval = null;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background: #141416;
          border: 1px solid #27272a;
          border-radius: 0.75rem;
          padding: 1.25rem;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #fafafa;
        }
        .percent {
          font-size: 0.8125rem;
          color: #a1a1aa;
          font-variant-numeric: tabular-nums;
        }
        .track {
          height: 8px;
          background: #1c1c1f;
          border-radius: 4px;
          overflow: hidden;
        }
        .bar {
          height: 100%;
          background: #3b82f6;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
      </style>
      <div class="card">
        <div class="header">
          <span class="title">Deployment Progress</span>
          <span class="percent">0%</span>
        </div>
        <div class="track">
          <div class="bar" style="width: 0%"></div>
        </div>
      </div>
    `;

    this._interval = setInterval(() => {
      if (this._progress >= 87) {
        this._progress = 0;
      } else {
        this._progress += 1;
      }
      const bar = this.shadowRoot.querySelector('.bar');
      const percent = this.shadowRoot.querySelector('.percent');
      if (bar) bar.style.width = `${this._progress}%`;
      if (percent) percent.textContent = `${this._progress}%`;
    }, 400);
  }

  disconnectedCallback() {
    clearInterval(this._interval);
  }
}
customElements.define('progress-card', ProgressCard);

// --- <order-table> ---
class OrderTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._statusIndex = 0;
    this._interval = null;
  }

  connectedCallback() {
    const statuses = ['Syncing...', 'Validating', 'Confirmed'];
    const statusColors = { 'Syncing...': '#f59e0b', 'Validating': '#3b82f6', 'Confirmed': '#22c55e' };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background: #141416;
          border: 1px solid #27272a;
          border-radius: 0.75rem;
          overflow: hidden;
        }
        .card-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #27272a;
          font-size: 0.875rem;
          font-weight: 600;
          color: #fafafa;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }
        th {
          text-align: left;
          padding: 0.625rem 1.25rem;
          color: #71717a;
          font-weight: 500;
          border-bottom: 1px solid #27272a;
        }
        td {
          padding: 0.75rem 1.25rem;
          color: #e4e4e7;
          border-bottom: 1px solid #1c1c1f;
        }
        tr:last-child td {
          border-bottom: none;
        }
        .badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          transition: background 0.2s, color 0.2s;
        }
      </style>
      <div class="card">
        <div class="card-header">Recent Orders</div>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>#4091</td>
              <td>Alice Park</td>
              <td><span class="badge" id="badge">Syncing...</span></td>
            </tr>
            <tr>
              <td>#4090</td>
              <td>Bob Chen</td>
              <td><span class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e;">Confirmed</span></td>
            </tr>
            <tr>
              <td>#4089</td>
              <td>Carol Wu</td>
              <td><span class="badge" style="background: rgba(59,130,246,0.15); color: #3b82f6;">Validating</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const badge = this.shadowRoot.getElementById('badge');
    this._updateBadge(badge, statuses[0], statusColors[statuses[0]]);

    this._interval = setInterval(() => {
      this._statusIndex = (this._statusIndex + 1) % statuses.length;
      const status = statuses[this._statusIndex];
      this._updateBadge(badge, status, statusColors[status]);
    }, 2500);
  }

  _updateBadge(badge, text, color) {
    if (!badge) return;
    badge.textContent = text;
    badge.style.color = color;
    badge.style.background = color.replace(')', ', 0.15)').replace('rgb(', 'rgba(');
    // Handle hex colors
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      badge.style.background = `rgba(${r}, ${g}, ${b}, 0.15)`;
    }
  }

  disconnectedCallback() {
    clearInterval(this._interval);
  }
}
customElements.define('order-table', OrderTable);

// --- <notif-popover> ---
class NotifPopover extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._open = false;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .wrapper {
          position: relative;
          background: #141416;
          border: 1px solid #27272a;
          border-radius: 0.75rem;
          padding: 1.25rem;
        }
        button {
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        button:hover {
          background: #2563eb;
        }
        .popover {
          display: none;
          position: absolute;
          bottom: calc(100% + 0.5rem);
          left: 1.25rem;
          background: #1c1c1f;
          border: 1px solid #27272a;
          border-radius: 0.625rem;
          padding: 0.75rem 1rem;
          min-width: 220px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 10;
        }
        .popover.open {
          display: block;
          animation: fadeIn 0.15s ease;
        }
        .notif-item {
          padding: 0.375rem 0;
          font-size: 0.8125rem;
          color: #e4e4e7;
          border-bottom: 1px solid #27272a;
        }
        .notif-item:last-child {
          border-bottom: none;
        }
        .notif-item .time {
          color: #71717a;
          font-size: 0.6875rem;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      <div class="wrapper">
        <div class="popover" id="popover">
          <div class="notif-item">Deploy succeeded <span class="time">2m ago</span></div>
          <div class="notif-item">New signup: dave@co.io <span class="time">5m ago</span></div>
          <div class="notif-item">Invoice #892 paid <span class="time">12m ago</span></div>
        </div>
        <button id="btn">Notifications (3)</button>
      </div>
    `;

    this.shadowRoot.getElementById('btn').addEventListener('click', () => {
      this._open = !this._open;
      this.shadowRoot.getElementById('popover').classList.toggle('open', this._open);
    });
  }
}
customElements.define('notif-popover', NotifPopover);

// --- <skeleton-card> ---
class SkeletonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._loaded = false;
    this._interval = null;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background: #141416;
          border: 1px solid #27272a;
          border-radius: 0.75rem;
          padding: 1.25rem;
          min-height: 120px;
        }
        .skeleton-line {
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(90deg, #1c1c1f 25%, #27272a 50%, #1c1c1f 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          margin-bottom: 0.75rem;
        }
        .skeleton-line:nth-child(1) { width: 40%; }
        .skeleton-line:nth-child(2) { width: 100%; }
        .skeleton-line:nth-child(3) { width: 75%; }
        .skeleton-line:nth-child(4) { width: 60%; margin-bottom: 0; }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .loaded-content {
          display: none;
        }
        .loaded-content.visible {
          display: block;
        }
        .loaded-content h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #fafafa;
          margin-bottom: 0.5rem;
        }
        .loaded-content p {
          font-size: 0.8125rem;
          color: #a1a1aa;
          line-height: 1.5;
        }
        .skeleton.hidden {
          display: none;
        }
      </style>
      <div class="card">
        <div class="skeleton" id="skeleton">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
        <div class="loaded-content" id="loaded">
          <h3>Analytics Summary</h3>
          <p>Conversion rate improved by 4.2% this week. Top performing channel: organic search with 12.8k sessions.</p>
        </div>
      </div>
    `;

    this._interval = setInterval(() => {
      this._loaded = !this._loaded;
      const skeleton = this.shadowRoot.getElementById('skeleton');
      const loaded = this.shadowRoot.getElementById('loaded');
      skeleton.classList.toggle('hidden', this._loaded);
      loaded.classList.toggle('visible', this._loaded);
    }, 4000);
  }

  disconnectedCallback() {
    clearInterval(this._interval);
  }
}
customElements.define('skeleton-card', SkeletonCard);
