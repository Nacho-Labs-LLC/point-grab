import { Component, OnDestroy, signal } from '@angular/core';

/** Shows whether Send has a live MCP destination (GET localhost:3456/health). */
@Component({
  selector: 'app-mcp-status',
  template: `
    <span class="mcp-status" data-testid="mcp-status" [attr.data-state]="state()" role="status">
      <span class="dot" aria-hidden="true"></span>
      @switch (state()) {
        @case ('online') { MCP server connected }
        @case ('offline') { MCP server offline · run <code>npx &#64;point-grab/mcp-server</code> to Send }
        @default { Checking MCP server… }
      }
    </span>
  `,
  styles: `
    .mcp-status { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-size: 0.82rem;
      background: rgba(148, 163, 184, 0.1); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.18); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
    [data-state='online'] .dot { background: #34d399; }
    [data-state='offline'] .dot { background: #f87171; }
    code { font-size: 0.78rem; color: #e2e8f0; }
  `,
})
export class McpStatusComponent implements OnDestroy {
  protected readonly state = signal<'checking' | 'online' | 'offline'>('checking');
  private readonly timer = setInterval(() => this.check(), 10000);
  private readonly onFocus = () => this.check();
  constructor() { this.check(); window.addEventListener('focus', this.onFocus); }
  private async check() {
    try {
      const res = await fetch('http://localhost:3456/health', { signal: AbortSignal.timeout(1500) });
      this.state.set(res.ok ? 'online' : 'offline');
    } catch { this.state.set('offline'); }
  }
  ngOnDestroy() { clearInterval(this.timer); window.removeEventListener('focus', this.onFocus); }
}
