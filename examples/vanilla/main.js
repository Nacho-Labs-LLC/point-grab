import { init } from '@point-grab/core';

const pg = init({ activationMode: 'hold' });

// --- Animations ---

// Progress bar
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
let progressValue = 0;

setInterval(() => {
  progressValue += 2 + Math.random() * 3;
  if (progressValue > 87) progressValue = 0;
  progressBar.style.width = `${Math.round(progressValue)}%`;
  progressLabel.textContent = `${Math.round(progressValue)}%`;
}, 400);

// Live status row
const liveStatus = document.getElementById('live-status');
const states = [
  { text: 'Syncing...', cls: 'info' },
  { text: 'Validating', cls: 'warning' },
  { text: 'Confirmed', cls: 'success' },
];
let stateIdx = 0;

setInterval(() => {
  stateIdx = (stateIdx + 1) % states.length;
  liveStatus.textContent = states[stateIdx].text;
  liveStatus.className = `badge ${states[stateIdx].cls}`;
}, 2500);

// Notification popover
const toggle = document.getElementById('notif-toggle');
const popover = document.getElementById('notif-popover');

toggle.addEventListener('click', () => {
  popover.classList.toggle('hidden');
});

// Skeleton loader
const skeleton = document.getElementById('skeleton');
const loaded = document.getElementById('skeleton-loaded');

setInterval(() => {
  skeleton.classList.toggle('hidden');
  loaded.classList.toggle('hidden');
}, 4000);
