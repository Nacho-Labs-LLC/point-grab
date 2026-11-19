<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

// Is Send's destination (the local MCP server) reachable?
const mcp = ref('checking');
async function check() {
  try { mcp.value = (await fetch('http://localhost:3456/health', { signal: AbortSignal.timeout(1500) })).ok ? 'online' : 'offline'; } catch { mcp.value = 'offline'; }
}
let timer;
onMounted(() => { check(); timer = setInterval(check, 10000); window.addEventListener('focus', check); });
onUnmounted(() => { clearInterval(timer); window.removeEventListener('focus', check); });
</script>

<template>
  <section class="playground-guide" data-testid="playground-guide" aria-labelledby="guide-title">
    <div class="guide-head">
      <div><span class="eyebrow">Vue playground</span><h2 id="guide-title">Try Point Grab on this product page</h2></div>
      <span class="mcp-status" data-testid="mcp-status" role="status" :data-state="mcp">
        <template v-if="mcp === 'online'">MCP server connected</template>
        <template v-else-if="mcp === 'offline'">MCP server offline · run <code>npx @point-grab/mcp-server</code> to Send</template>
        <template v-else>Checking MCP server…</template>
      </span>
    </div>
    <ol><li><strong>Grab</strong> Hold <kbd>Ctrl+B</kbd>, hover the garment, a color swatch or a bag item and click. Your clipboard gets its HTML plus the Vue component and source file.</li><li><strong>Comment</strong> Toolbar <kbd>⋯</kbd> → Add Comment, click an element, write a note. Queue a few, then Confirm &amp; Copy.</li><li><strong>Freeze</strong> Hover <em>A note on fit</em>, hold <kbd>Ctrl+B</kbd> and press <kbd>F</kbd>. Hover states and motion hold still. <kbd>Esc</kbd> resumes.</li><li><strong>Screenshot</strong> <kbd>⋯</kbd> → Add screenshot, drag over the product, add a note and Send it to your AI.</li><li><strong>History</strong> The clock button lists every grab. Click one to copy it again.</li></ol>
  </section>
</template>
