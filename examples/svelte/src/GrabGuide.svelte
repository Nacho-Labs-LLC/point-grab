<script>
  import { onMount } from 'svelte';

  // Is Send's destination (the local MCP server) reachable?
  let mcp = $state('checking');
  async function check() {
    try { mcp = (await fetch('http://localhost:3456/health', { signal: AbortSignal.timeout(1500) })).ok ? 'online' : 'offline'; } catch { mcp = 'offline'; }
  }
  onMount(() => {
    check();
    const timer = setInterval(check, 10000);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); };
  });
</script>

<section class="playground-guide" data-testid="playground-guide" aria-labelledby="guide-title">
  <div class="guide-head">
    <div><span class="eyebrow">Svelte playground</span><h2 id="guide-title">Try Point Grab on your notes</h2></div>
    <span class="mcp-status" data-testid="mcp-status" role="status" data-state={mcp}>
      {#if mcp === 'online'}MCP server connected{:else if mcp === 'offline'}MCP server offline · run <code>npx @point-grab/mcp-server</code> to Send{:else}Checking MCP server…{/if}
    </span>
  </div>
  <ol><li><strong>Grab</strong> Hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd>, hover a note card or a formatting button and click. Your clipboard gets its HTML plus the Svelte component and source file.</li><li><strong>Comment</strong> Toolbar <kbd>⋯</kbd> → Add Comment, click an element, write a note. Queue a few, then Confirm &amp; Copy.</li><li><strong>Freeze</strong> Hover <em>Writing flow</em>, hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd> and press <kbd>F</kbd>. Hover states and motion hold still. <kbd>Esc</kbd> resumes.</li><li><strong>Screenshot</strong> <kbd>⋯</kbd> → Add screenshot, drag over the editor, add a note and Send it to your AI.</li><li><strong>History</strong> The clock button lists every grab. Click one to copy it again.</li></ol>
</section>
