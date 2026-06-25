import { useState, useEffect, useRef } from 'react';
import { usePointGrab } from '@point-grab/react';
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
  {
    id: 3,
    name: 'Rosa Lin',
    handle: '@rosalin_dev',
    avatar: 'RL',
    avatarColor: '#f59e0b',
    time: '45m ago',
    text: 'tip for vibe coders: when you want to fix a specific UI element, you have to give the AI the exact HTML, class names, component name, and file. otherwise it guesses wrong every time.',
    likes: 312,
    replies: 58,
    reposts: 89,
  },
  {
    id: 4,
    name: 'Zach Moore',
    handle: '@z_moore',
    avatar: 'ZM',
    avatarColor: '#ec4899',
    time: '2h ago',
    text: 'built a whole SaaS UI today. none of it is real but it looks incredible. shipped the vibe first, will add the logic later.',
    likes: 871,
    replies: 143,
    reposts: 201,
  },
];

function Avatar({ initials, color, size = 40 }) {
  return (
    <div
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function Post({ post }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [animating, setAnimating] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyRef = useRef(null);

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  }

  function handleReply(e) {
    e.stopPropagation();
    setReplyOpen(r => !r);
  }

  useEffect(() => {
    if (!replyOpen) return;
    const close = (e) => {
      if (replyRef.current && !replyRef.current.contains(e.target)) {
        setReplyOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [replyOpen]);

  return (
    <article className="post">
      <Avatar initials={post.avatar} color={post.avatarColor} />
      <div className="post-body">
        <div className="post-meta">
          <span className="post-name">{post.name}</span>
          <span className="post-handle">{post.handle}</span>
          <span className="post-dot">·</span>
          <span className="post-time">{post.time}</span>
        </div>
        <p className="post-text">{post.text}</p>
        <div className="post-actions">
          <button className="action-btn reply-btn" onClick={handleReply}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{post.replies}</span>
          </button>
          <button className="action-btn repost-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <span>{post.reposts}</span>
          </button>
          <button
            className={`action-btn like-btn ${liked ? 'liked' : ''} ${animating ? 'pop' : ''}`}
            onClick={handleLike}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{likeCount}</span>
          </button>
        </div>

        {replyOpen && (
          <div className="reply-popover" ref={replyRef}>
            <Avatar initials="ME" color="#818cf8" size={32} />
            <div className="reply-input-wrap">
              <input
                className="reply-input"
                placeholder={`Reply to ${post.name}…`}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                autoFocus
              />
              <button
                className="reply-send"
                disabled={!replyText.trim()}
                onClick={() => { setReplyText(''); setReplyOpen(false); }}
              >
                Reply
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function NewPostsBanner({ count, onDismiss }) {
  if (!count) return null;
  return (
    <button className="new-posts-banner" onClick={onDismiss}>
      ↑ {count} new post{count > 1 ? 's' : ''}
    </button>
  );
}

export default function App() {
  usePointGrab({ activationMode: 'hold', devOnly: false });

  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setNewCount(2), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#6366f1"/></svg>
            Thread
          </div>
        </div>
        <Avatar initials="ME" color="#818cf8" size={34} />
      </header>

      <div className="feed-hint">
        Hold <kbd>Cmd+C</kbd> / <kbd>Ctrl+C</kbd>, click a post, choose <strong>Add Comment</strong>, review a few elements, then hit <strong>Confirm & Copy</strong>.
      </div>

      <section className="review-mission">
        <div>
          <div className="review-kicker">Comment-mode showcase</div>
          <h1>Review this feed like you would in a real product pass.</h1>
          <p>Best targets: a post body, the animated like button, the delayed new-posts banner, and the reply popover. The goal is not one grab — it is batching several reviewed elements into one AI-ready prompt.</p>
        </div>
        <ul className="review-checklist">
          <li>Comment on a post body that needs copy changes</li>
          <li>Comment on the heart animation or reply popover</li>
          <li>Confirm & Copy the whole review batch</li>
        </ul>
      </section>

      <main className="feed">
        <NewPostsBanner count={newCount} onDismiss={() => setNewCount(0)} />
        {POSTS.map(post => <Post key={post.id} post={post} />)}
      </main>
    </div>
  );
}
