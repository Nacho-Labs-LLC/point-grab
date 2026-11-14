import { Component } from '@angular/core';
import { McpStatusComponent } from './mcp-status';

@Component({
  selector: 'app-playground-guide',
  imports: [McpStatusComponent],
  template: `
    <section class="guide" data-testid="playground-guide" aria-labelledby="guide-title">
      <div class="guide-head">
        <div>
          <span class="eyebrow">Angular playground</span>
          <h2 id="guide-title">Try Point Grab on this board</h2>
        </div>
        <app-mcp-status />
      </div>
      <ol>
        <li><strong>Grab</strong> Hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd>, hover a task card and click. Your clipboard gets its HTML plus the Angular component and its ancestors.</li>
        <li><strong>Comment</strong> Toolbar <kbd>⋯</kbd> → Add Comment, click an element, write a note. Queue a few, then Confirm &amp; Copy.</li>
        <li><strong>Freeze</strong> Hover <em>3 online</em> in the header, hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd> and press <kbd>F</kbd>. The popover and live pulse hold still. <kbd>Esc</kbd> resumes.</li>
        <li><strong>Screenshot</strong> <kbd>⋯</kbd> → Add screenshot, drag over part of the board, add a note and Send it to your AI.</li>
        <li><strong>History</strong> The clock button lists every grab. Click one to copy it again.</li>
      </ol>
    </section>
  `,
  styles: `
    .guide { margin-top: 28px; padding: 24px; border-radius: 20px; border: 1px solid rgba(148, 163, 184, 0.16); background: rgba(15, 23, 42, 0.7); }
    .guide-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
    .eyebrow { color: #93c5fd; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    h2 { margin: 6px 0 0; color: #f8fafc; font-size: 1.3rem; }
    ol { margin: 18px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; counter-reset: step; }
    li { counter-increment: step; color: #cbd5e1; font-size: 0.9rem; line-height: 1.55; }
    li strong { display: block; color: #f8fafc; margin-bottom: 4px; }
    li strong::before { content: counter(step) ' · '; color: #93c5fd; }
    kbd { font: 0.75rem ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(148, 163, 184, 0.3); color: #e2e8f0; }
  `,
})
export class PlaygroundGuideComponent {}
