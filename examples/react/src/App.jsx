import { useState, useEffect, useRef } from 'react';
import { usePointGrab } from '@point-grab/react';
import './App.css';
import GrabGuide, { FreezePreview } from './GrabGuide';

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

function Post({ post, saved, onSave }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [animating, setAnimating] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState([]);
  const [reposted, setReposted] = useState(false);
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
    <article className="post" data-testid="post">
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
          <button aria-label="Reply to post" aria-expanded={replyOpen} className="action-btn reply-btn" onClick={handleReply}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{post.replies + replies.length}</span>
          </button>
          <button aria-label="Repost" aria-pressed={reposted} onClick={() => setReposted(!reposted)} className="action-btn repost-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <span>{post.reposts + Number(reposted)}</span>
          </button>
          <button
            className={`action-btn like-btn ${liked ? 'liked' : ''} ${animating ? 'pop' : ''}`}
            aria-label="Like post" aria-pressed={liked} onClick={handleLike}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{likeCount}</span>
          </button>
        </div>

        <button className="action-btn" aria-label="Save post" aria-pressed={saved} onClick={onSave}>{saved ? 'Saved' : 'Save'}</button>
        {replies.map((text, index) => <p className="posted-reply" key={index}><strong>You</strong> · {text}</p>)}
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
                onClick={() => { setReplies([...replies, replyText.trim()]); setReplyText(''); setReplyOpen(false); }}
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

const MAX_POST = 280;

function Composer({ onPublish }) {
  const [text, setText] = useState('');
  const remaining = MAX_POST - text.length;
  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onPublish(text.trim());
    setText('');
  }
  return (
    <form className="composer" onSubmit={submit} aria-label="New post">
      <Avatar initials="ME" color="#818cf8" />
      <div className="composer-body">
        <textarea aria-label="What are you building?" placeholder="What are you building?" maxLength={MAX_POST} rows={2} value={text} onChange={e => setText(e.target.value)} />
        <div className="composer-foot">
          <span className={`composer-count${remaining < 20 ? ' low' : ''}`} data-testid="composer-count">{remaining}</span>
          <button type="submit" className="composer-submit" disabled={!text.trim()}>Post</button>
        </div>
      </div>
    </form>
  );
}

export default function App() {
  const pointGrab = usePointGrab({ activationMode: 'hold', devOnly: false });
  // Show the toolbar on arrival so Actions → Add screenshot is discoverable.
  useEffect(() => { pointGrab?.showToolbar(); }, [pointGrab]);

  const [posts, setPosts] = useState(POSTS);
  const [newCount, setNewCount] = useState(0);
  const [saved, setSaved] = useState([]);
  const [savedOnly, setSavedOnly] = useState(false);

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
        Hold <kbd>Ctrl+B</kbd> and click anything to grab it for your AI
      </div>

      <section className="feed-intro"><span className="eyebrow">THREAD / FOR PEOPLE WHO BUILD</span><h1>Good ideas start<br />with a conversation.</h1><p>A little corner of the internet for people who build. Like, reply, repost, or save something worth coming back to.</p><FreezePreview /></section>
      <nav className="feed-tabs" aria-label="Feed view"><button aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)}>For you</button><button aria-pressed={savedOnly} onClick={() => setSavedOnly(true)}>Saved only</button></nav>
      <main className="feed">
        <Composer onPublish={text => setPosts(list => [{ id: Date.now(), name: 'You', handle: '@you', avatar: 'ME', avatarColor: '#818cf8', time: 'now', text, likes: 0, replies: 0, reposts: 0 }, ...list])} />
        <NewPostsBanner count={newCount} onDismiss={() => setNewCount(0)} />
        {posts.map(post => <div key={post.id} hidden={savedOnly && !saved.includes(post.id)}><Post post={post} saved={saved.includes(post.id)} onSave={() => setSaved(previous => previous.includes(post.id) ? previous.filter(id => id !== post.id) : [...previous, post.id])} /></div>)}
        {savedOnly && saved.length === 0 && <p className="empty-feed">No posts in this view.</p>}
      </main>
      <GrabGuide />
    </div>
  );
}
