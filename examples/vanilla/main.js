import { init } from '@point-grab/core';

init({ activationMode: 'hold', devOnly: false });

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
let liked = false;

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
const elVolumeSlider = document.getElementById('volume-slider');
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
  progress = 0;
  updateProgress();
  renderQueue();
}

function updateProgress() {
  elFill.style.width = `${progress}%`;
  elThumb.style.left = `${progress}%`;

  const totalSecs = parseDuration(tracks[currentIdx].duration);
  const elapsed = Math.round((progress / 100) * totalSecs);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  elElapsed.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function parseDuration(str) {
  const [m, s] = str.split(':').map(Number);
  return m * 60 + s;
}

setInterval(() => {
  if (!playing) return;
  progress += 0.25;
  if (progress >= 100) {
    progress = 0;
    currentIdx = (currentIdx + 1) % tracks.length;
    loadTrack(currentIdx);
  }
  updateProgress();
}, 200);

elBtnPlay.addEventListener('click', () => {
  playing = !playing;
  elIconPause.classList.toggle('hidden', !playing);
  elIconPlay.classList.toggle('hidden', playing);
});

elBtnPrev.addEventListener('click', () => {
  currentIdx = (currentIdx - 1 + tracks.length) % tracks.length;
  loadTrack(currentIdx);
});

elBtnNext.addEventListener('click', () => {
  currentIdx = (currentIdx + 1) % tracks.length;
  loadTrack(currentIdx);
});

elHeart.addEventListener('click', () => {
  liked = !liked;
  elHeart.textContent = liked ? '♥' : '♡';
  elHeart.classList.toggle('liked', liked);
});

elBtnVolume.addEventListener('click', (e) => {
  e.stopPropagation();
  elVolumePop.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  elVolumePop.classList.add('hidden');
});

elVolumeSlider.addEventListener('input', () => {
  elVolumePct.textContent = `${elVolumeSlider.value}%`;
});

function renderQueue() {
  elQueueList.innerHTML = '';
  tracks.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = `queue-item${i === currentIdx ? ' active' : ''}`;
    item.dataset.idx = i;

    const numEl = document.createElement('div');
    numEl.className = 'queue-num';
    if (i === currentIdx) {
      const dot = document.createElement('div');
      dot.className = 'queue-dot';
      numEl.appendChild(dot);
    } else {
      numEl.textContent = i + 1;
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
}

loadTrack(currentIdx);
