import { useEffect, useRef, useState } from 'react';
import { getPointGrabApi, registerPointGrabPlugin, usePointGrab } from '@point-grab/react';
import './App.css';

const POSTS = [
  {
    id: 1,
    name: 'Mia Chen',
    handle: '@mia_builds',
    avatar: 'MC',
    avatarColor: '#6366f1',
    time: '2m ago',
    text: "just shipped my first side project with AI help and honestly the hardest part wasn't the code — it was explaining to the AI exactly which button I wanted to change 😅",
    likes: 48,
    replies: 12,
    reposts: 7,
  },
  {
    id: 2,
    name: 'Dev Patel',
    handle: '@devpatel_hq',
    avatar: 'DP',
    avatarColor: '#10b981',
    time: '18m ago',
    text: 'Hot take: the gap between "I have a coding idea" and "it\'s actually working" is 80% debugging CSS. Vibe coding changed my life but the styling part still hurts.',
    likes: 124,
    replies: 31,
    reposts: 22,
  },
];

function promptFromCopiedAnnotations(annotations) {
  return annotations
    .map(({ snippet, comment }, index) => `## Element ${index + 1}\n${snippet}\n\nComment: ${comment}`)
    .join('\n\n---\n\n');
}

function Avatar({ initials, color, size = 40 }) {
  return (
    <div className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

function Post({ post, highlightActions, highlightReply }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyRef = useRef(null);

  useEffect(() => {
    if (highlightReply) setReplyOpen(true);
  }, [highlightReply]);

  useEffect(() => {
    if (!replyOpen) return undefined;
    const close = (event) => {
      if (highlightReply) return;
      if (event.target.closest?.('#__point-grab-toolbar__, #__point-grab-actions-menu__')) return;
      if (replyRef.current && !replyRef.current.contains(event.target)) setReplyOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [replyOpen]);

  return (
    <article className="post">
      <Avatar initials={post.avatar} color={post.avatarColor} />
      <div className="post-body">
        <div className="post-meta">
          <span className="post-name">{post.name}</span><span className="post-handle">{post.handle}</span>
          <span className="post-dot">·</span><span className="post-time">{post.time}</span>
        </div>
        <p className="post-text">{post.text}</p>
        <div className={`post-actions ${highlightActions ? 'walkthrough-target' : ''}`}>
          <button className="action-btn reply-btn" onClick={(event) => { event.stopPropagation(); setReplyOpen((open) => !open); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg><span>{post.replies}</span>
          </button>
          <button className="action-btn repost-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg><span>{post.reposts}</span></button>
          <button className={`action-btn like-btn ${liked ? 'liked' : ''}`} onClick={() => { setLiked((value) => !value); setLikeCount((count) => count + (liked ? -1 : 1)); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg><span>{likeCount}</span>
          </button>
        </div>
        {replyOpen && (
          <div className={`reply-popover ${highlightReply ? 'walkthrough-target' : ''}`} ref={replyRef}>
            <Avatar initials="ME" color="#818cf8" size={32} />
            <div className="reply-input-wrap">
              <input className="reply-input" placeholder={`Reply to ${post.name}…`} value={replyText} onChange={(event) => setReplyText(event.target.value)} autoFocus />
              <button className="reply-send" disabled={!replyText.trim()} onClick={() => { setReplyText(''); setReplyOpen(false); }}>Reply</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function App() {
  usePointGrab({ devOnly: false });
  const [preview, setPreview] = useState('');
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [complete, setComplete] = useState(false);
  const copiedAnnotations = useRef([]);
  const flushTimer = useRef(null);

  useEffect(() => {
    const pluginName = 'react-walkthrough-prompt-preview';
    registerPointGrabPlugin({
      name: pluginName,
      hooks: {
        onCopySuccess: (snippet, _context, comment) => {
          if (!comment) return;
          copiedAnnotations.current.push({ snippet, comment });
          if (flushTimer.current) clearTimeout(flushTimer.current);
          flushTimer.current = setTimeout(() => {
            const prompt = promptFromCopiedAnnotations(copiedAnnotations.current);
            setPreview(prompt);
            setAcceptedCount(copiedAnnotations.current.length);
            copiedAnnotations.current = [];
          }, 0);
        },
      },
    });

    const onEndCapture = (event) => {
      const control = event.target.closest?.('[data-point-grab-btn="copyPrompt"]');
      if (control?.getAttribute('aria-label')?.startsWith('End Capture Mode')) {
        setTimeout(() => setComplete(true), 0);
      }
    };
    document.addEventListener('click', onEndCapture, true);
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      document.removeEventListener('click', onEndCapture, true);
      getPointGrabApi()?.unregisterPlugin(pluginName);
    };
  }, []);

  const step = acceptedCount === 0 ? 1 : acceptedCount === 1 ? 2 : 3;
  const instruction = step === 1
    ? 'Open Mia’s reply composer, then start Capture mode and accept a note on the highlighted action row.'
    : step === 2
      ? 'Use Skip on any accidental selection, then accept a note on the highlighted reply composer.'
      : 'Inspect the exact aggregate prompt below, then use End Capture Mode to finish the review.';

  return (
    <div className="app">
      <header className="app-header"><div className="app-logo">Thread</div><Avatar initials="ME" color="#818cf8" size={34} /></header>
      <section className="walkthrough-card" aria-live="polite">
        <div className="walkthrough-progress"><span>Step {step} of 3</span><span aria-hidden="true">● ● ●</span></div>
        <strong>{step === 1 ? 'Start Capture Mode' : step === 2 ? 'Capture the conditional UI' : 'Review and complete'}</strong>
        <p>{instruction}</p>
      </section>
      <div className="feed-hint">Start Capture Mode with <kbd>Cmd+Shift+C</kbd> / <kbd>Ctrl+Shift+C</kbd>, or click Capture mode below.</div>
      <main className="feed">
        {POSTS.map((post, index) => <Post key={post.id} post={post} highlightActions={index === 0 && acceptedCount === 0} highlightReply={index === 0 && acceptedCount === 1} />)}
      </main>
      <section className="prompt-panel" aria-label="Actual aggregate prompt preview">
        <div><strong>Actual aggregate prompt</strong><span>Updated by Point-grab after every accepted comment.</span></div>
        <pre data-testid="prompt-preview">{preview || 'Your accepted comments will appear here exactly as Point-grab writes them to the clipboard.'}</pre>
      </section>
      {complete && (
        <section className="completion-panel" data-testid="walkthrough-complete">
          <strong>{acceptedCount} reviewed elements + comments are ready for your AI agent.</strong>
          <span>Paste this into your AI agent.</span>
          <button onClick={() => navigator.clipboard.writeText(preview)}>Copy prompt</button>
        </section>
      )}
    </div>
  );
}
