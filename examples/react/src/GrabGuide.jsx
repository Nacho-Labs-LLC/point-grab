import { useEffect, useState } from 'react';

export function FreezePreview() {
  return <div className="freeze-demo"><span className="motion-sample" data-testid="motion-sample" aria-hidden="true">✦</span><span>One good idea, in motion.</span><span className="freeze-help"><button data-testid="freeze-trigger" aria-describedby="freeze-tip">Why the sparkle?</button><span role="tooltip" id="freeze-tip" data-testid="freeze-popover">Every post here started as a half-formed idea. The sparkle is for the ones that made it.</span></span></div>;
}

/** Is Send's destination (the local MCP server) reachable? */
function useMcpStatus() {
  const [state, setState] = useState('checking');
  useEffect(() => {
    const check = async () => {
      try { setState((await fetch('http://localhost:3456/health', { signal: AbortSignal.timeout(1500) })).ok ? 'online' : 'offline'); } catch { setState('offline'); }
    };
    check();
    const timer = setInterval(check, 10000);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);
  return state;
}

export function McpStatus() {
  const state = useMcpStatus();
  return (
    <span className="mcp-status" data-testid="mcp-status" role="status" data-state={state}>
      {state === 'online' ? 'MCP server connected' : state === 'offline' ? <>MCP server offline · run <code>npx @point-grab/mcp-server</code> to Send</> : 'Checking MCP server…'}
    </span>
  );
}

export default function GrabGuide() {
  return (
    <section className="playground-guide" data-testid="playground-guide" aria-labelledby="guide-title">
      <div className="guide-head"><div><span className="eyebrow">React playground</span><h2 id="guide-title">Try Point Grab on this thread</h2></div><McpStatus /></div>
      <ol><li><strong>Grab</strong> Hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd>, hover a post's author or its Like button and click. Your clipboard gets its HTML plus the React component and source file.</li><li><strong>Comment</strong> Toolbar <kbd>⋯</kbd> → Add Comment, click an element, write a note. Queue a few, then Confirm &amp; Copy.</li><li><strong>Freeze</strong> Hover <em>Why the sparkle?</em>, hold <kbd>⌘C</kbd> / <kbd>Ctrl+C</kbd> and press <kbd>F</kbd>. Hover states and motion hold still. <kbd>Esc</kbd> resumes.</li><li><strong>Screenshot</strong> <kbd>⋯</kbd> → Add screenshot, drag over a post, add a note and Send it to your AI.</li><li><strong>History</strong> The clock button lists every grab. Click one to copy it again.</li></ol>
    </section>
  );
}
