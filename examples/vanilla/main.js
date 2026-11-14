import { init } from '@point-grab/core';
import { parseDuration, nextTrackIndex } from './player-model.js';

const pointGrab = init({ activationMode: 'hold', devOnly: false });
pointGrab.showToolbar(); // Show the toolbar on arrival so Actions → Add screenshot is discoverable.

// Is Send's destination (the local MCP server) reachable?
async function checkMcp() {
  try { return (await fetch('http://localhost:3456/health', { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
const mcpStatus = document.querySelector('[data-testid="mcp-status"]');
async function updateMcpStatus() {
  const online = await checkMcp();
  mcpStatus.dataset.state = online ? 'online' : 'offline';
  mcpStatus.innerHTML = online ? 'MCP server connected' : 'MCP server offline · run <code>npx @point-grab/mcp-server</code> to Send';
}
updateMcpStatus();
setInterval(updateMcpStatus, 10000);
window.addEventListener('focus', updateMcpStatus);

const tracks = [
  { title: 'Neon Dreams',   artist: 'Synthwave Collective', album: 'Chrome Horizon', duration: '3:47', color: 'linear-gradient(135deg,#4f46e5,#7c3aed,#db2777)' },
  { title: 'Midnight Circuit', artist: 'VΛSION',           album: 'Signal Path',    duration: '4:12', color: 'linear-gradient(135deg,#0ea5e9,#6366f1,#8b5cf6)' },
  { title: 'Glass City',    artist: 'Parallax',             album: 'Refract',        duration: '3:29', color: 'linear-gradient(135deg,#10b981,#0ea5e9,#6366f1)' },
  { title: 'Retrograde',    artist: 'Luminos',              album: 'Phase IV',       duration: '5:01', color: 'linear-gradient(135deg,#f59e0b,#ef4444,#8b5cf6)' },
  { title: 'Pulse & Static',artist: 'Synthwave Collective', album: 'Chrome Horizon', duration: '3:55', color: 'linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4)' },
];

let currentIdx = 0;
let playing = true;
let progress = 37; // start mid-song
const likes = new Set();
let shuffle = false;
let repeat = false;

const elAlbumArt   = document.getElementById('album-art');
const elTitle      = document.getElementById('track-title');
const elArtist     = document.getElementById('track-artist');
const elFill       = document.getElementById('progress-fill');
const elThumb      = document.getElementById('progress-thumb');
const elElapsed    = document.getElementById('time-elapsed');
const elTotal      = document.getElementById('time-total');
const elBtnPlay    = document.getElementById('btn-play');
const elIconPause  = document.getElementById('icon-pause');
const elIconPlay   = document.getElementById('icon-play');
const elBtnPrev    = document.getElementById('btn-prev');
const elBtnNext    = document.getElementById('btn-next');
const elBtnVolume  = document.getElementById('btn-volume');
const elVolumePop  = document.getElementById('volume-popover');
const elVolumeSlider = /** @type {HTMLInputElement} */ (document.getElementById('volume-slider'));
const elVolumePct  = document.getElementById('volume-pct');
const elQueueList  = document.getElementById('queue-list');
const elHeart      = document.getElementById('heart-btn');

function loadTrack(idx) {
  const t = tracks[idx];
  elTitle.textContent = t.title;
  elArtist.textContent = t.artist;
  document.querySelector('.track-album').textContent = t.album;
  elAlbumArt.style.background = t.color;
  elTotal.textContent = t.duration;
  elHeart.textContent = likes.has(idx) ? '♥' : '♡';
  elHeart.classList.toggle('liked', likes.has(idx));
  elHeart.setAttribute('aria-pressed', String(likes.has(idx)));
  progress = 0;
  updateProgress();
  renderQueue();
}

function updateProgress() {
  elFill.style.width = `${progress}%`;
  document.getElementById('progress-track').setAttribute('aria-valuenow', String(Math.round(progress)));
  elThumb.style.left = `${progress}%`;

  const totalSecs = parseDuration(tracks[currentIdx].duration);
  const elapsed = Math.round((progress / 100) * totalSecs);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  elElapsed.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

setInterval(() => {
  if (!playing) return;
  progress += 0.25;
  if (progress >= 100) {
    progress = 0;
    currentIdx = repeat ? currentIdx : nextIndex();
    loadTrack(currentIdx);
  }
  updateProgress();
}, 200);

elBtnPlay.addEventListener('click', () => {
  playing = !playing;
  elBtnPlay.setAttribute('aria-label', playing ? 'Pause playback' : 'Resume playback');
  elBtnPlay.setAttribute('aria-pressed', String(playing));
  elIconPause.classList.toggle('hidden', !playing);
  elIconPlay.classList.toggle('hidden', playing);
});

elBtnPrev.addEventListener('click', () => {
  currentIdx = (currentIdx - 1 + tracks.length) % tracks.length;
  loadTrack(currentIdx);
});

elBtnNext.addEventListener('click', () => {
  currentIdx = nextIndex();
  loadTrack(currentIdx);
});

elHeart.addEventListener('click', () => {
  const liked = !likes.has(currentIdx);
  if (liked) likes.add(currentIdx); else likes.delete(currentIdx);
  elHeart.setAttribute('aria-pressed', String(liked));
  elHeart.textContent = liked ? '♥' : '♡';
  elHeart.classList.toggle('liked', liked);
});

elBtnVolume.addEventListener('click', (e) => {
  e.stopPropagation();
  elVolumePop.classList.toggle('hidden');
  elBtnVolume.setAttribute('aria-expanded', String(!elVolumePop.classList.contains('hidden')));
});

document.addEventListener('click', () => {
  elVolumePop.classList.add('hidden');
  elBtnVolume.setAttribute('aria-expanded', 'false');
});
elVolumePop.addEventListener('click', e => e.stopPropagation());

elVolumeSlider.addEventListener('input', () => {
  elVolumePct.textContent = `${elVolumeSlider.value}%`;
});

const elQueueFilter = document.getElementById('queue-filter');
const elQueueEmpty = document.getElementById('queue-empty');
elQueueFilter.addEventListener('input', () => renderQueue());

function renderQueue() {
  elQueueList.innerHTML = '';
  const query = elQueueFilter.value.trim().toLowerCase();
  let shown = 0;
  tracks.forEach((t, i) => {
    if (query && !`${t.title} ${t.artist}`.toLowerCase().includes(query)) return;
    shown++;
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('aria-label', `Play ${t.title}`);
    item.setAttribute('aria-pressed', String(i === currentIdx));
    item.className = `queue-item${i === currentIdx ? ' active' : ''}`;
    item.dataset.idx = String(i);

    const numEl = document.createElement('div');
    numEl.className = 'queue-num';
    if (i === currentIdx) {
      const dot = document.createElement('div');
      dot.className = 'queue-dot';
      numEl.appendChild(dot);
    } else {
      numEl.textContent = String(i + 1);
    }

    const art = document.createElement('div');
    art.className = 'queue-art';
    art.style.background = t.color;

    const info = document.createElement('div');
    info.className = 'queue-info';
    info.innerHTML = `<div class="queue-title">${t.title}</div><div class="queue-artist">${t.artist}</div>`;

    const dur = document.createElement('div');
    dur.className = 'queue-duration';
    dur.textContent = t.duration;

    item.append(numEl, art, info, dur);
    item.addEventListener('click', () => {
      currentIdx = i;
      loadTrack(currentIdx);
    });
    elQueueList.appendChild(item);
  });
  elQueueEmpty.classList.toggle('hidden', shown > 0);
}

loadTrack(currentIdx);
elBtnPlay.setAttribute('aria-label', 'Pause playback');
elBtnPlay.setAttribute('aria-pressed', 'true');
elBtnVolume.setAttribute('aria-expanded', 'false');
elBtnVolume.setAttribute('aria-controls', 'volume-popover');
function nextIndex() {
  return nextTrackIndex(currentIdx, tracks.length, shuffle);
}
for (const id of ['shuffle', 'repeat']) {
  const button = document.getElementById(`btn-${id}`);
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    if (id === 'shuffle') shuffle = !shuffle; else repeat = !repeat;
    button.setAttribute('aria-pressed', String(id === 'shuffle' ? shuffle : repeat));
  });
}
const seek = document.getElementById('progress-track');
seek.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  progress = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : Math.min(100, Math.max(0, progress + (event.key === 'ArrowRight' ? 5 : -5)));
  updateProgress();
});
seek.addEventListener('click', event => {
  const bounds = seek.getBoundingClientRect();
  progress = Math.min(100, Math.max(0, (event.clientX - bounds.left) / bounds.width * 100));
  updateProgress();
});
