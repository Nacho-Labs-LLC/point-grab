<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// Progress bar state
const progressWidth = ref(0);
const progressLabel = ref('0%');
let progressInterval;

// Status badge cycling
const statusStates = [
  { text: 'Syncing...', class: 'info' },
  { text: 'Validating', class: 'warning' },
  { text: 'Confirmed', class: 'success' },
];
const statusIndex = ref(0);
let statusInterval;

// Notification popover
const popoverOpen = ref(false);

function togglePopover() {
  popoverOpen.value = !popoverOpen.value;
}

// Skeleton loader
const skeletonLoading = ref(true);
let skeletonInterval;

onMounted(() => {
  // Progress bar: fills 0% → ~87% then resets
  let progress = 0;
  progressInterval = setInterval(() => {
    progress += 3;
    if (progress > 87) progress = 0;
    progressWidth.value = progress;
    progressLabel.value = `${progress}%`;
  }, 400);

  // Status badge cycles every 2500ms
  statusInterval = setInterval(() => {
    statusIndex.value = (statusIndex.value + 1) % statusStates.length;
  }, 2500);

  // Skeleton toggles every 4000ms
  skeletonInterval = setInterval(() => {
    skeletonLoading.value = !skeletonLoading.value;
  }, 4000);
});

onUnmounted(() => {
  clearInterval(progressInterval);
  clearInterval(statusInterval);
  clearInterval(skeletonInterval);
});
</script>

<template>
  <header>
    <h1>pointgrab <span class="accent">vue</span></h1>
    <p class="subtitle">
      Hold <kbd>Cmd+C</kbd> (Mac) or <kbd>Ctrl+C</kbd> (Win) and hover over any element.
      Click to capture. Press <kbd>F</kbd> to freeze animations.
    </p>
  </header>

  <main>
    <!-- Dashboard stats -->
    <section class="card">
      <h2>Dashboard</h2>
      <div class="stats">
        <div class="stat">
          <span class="stat-label">Revenue</span>
          <span class="stat-value">$12,847</span>
          <span class="stat-change positive">+14.2%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Orders</span>
          <span class="stat-value">284</span>
          <span class="stat-change positive">+8.1%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Fulfillment</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progressWidth + '%' }"></div>
          </div>
          <span class="stat-change">{{ progressLabel }}</span>
        </div>
      </div>
    </section>

    <!-- Orders table -->
    <section class="card">
      <div class="card-header">
        <h2>Recent Orders</h2>
        <button class="btn-primary">+ New Order</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>#1847</td>
            <td>Sarah Chen</td>
            <td>$249.00</td>
            <td><span class="badge warning">Processing</span></td>
          </tr>
          <tr>
            <td>#1846</td>
            <td>Mike Johnson</td>
            <td>$89.50</td>
            <td><span class="badge success">Shipped</span></td>
          </tr>
          <tr>
            <td>#1845</td>
            <td>Alex Rivera</td>
            <td>$412.00</td>
            <td>
              <span :class="['badge', statusStates[statusIndex].class]">
                {{ statusStates[statusIndex].text }}
              </span>
            </td>
          </tr>
          <tr>
            <td>#1844</td>
            <td>Priya Patel</td>
            <td>$175.25</td>
            <td><span class="badge success">Delivered</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Notification popover -->
    <section class="card">
      <div class="card-header">
        <h2>Notifications</h2>
        <button class="btn-secondary" @click="togglePopover">
          {{ popoverOpen ? 'Hide popover' : 'Show popover' }}
        </button>
      </div>
      <div v-if="popoverOpen" class="popover">
        <div class="popover-item">
          <span class="dot blue"></span> New order #1847 received <small>2 min ago</small>
        </div>
        <div class="popover-item">
          <span class="dot amber"></span> Inventory low on SKU-2291 <small>18 min ago</small>
        </div>
        <div class="popover-item">
          <span class="dot green"></span> Deployment v2.4.1 succeeded <small>1 hr ago</small>
        </div>
      </div>
    </section>

    <!-- Skeleton loader -->
    <section class="card">
      <h2>Processing Queue</h2>
      <div v-if="skeletonLoading" class="skeleton">
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line narrow"></div>
      </div>
      <div v-else>
        <p class="stat-value">12</p>
        <p class="stat-change warning">items in queue</p>
      </div>
    </section>
  </main>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0a0a0b;
  --bg-raised: #141416;
  --bg-muted: #1c1c1f;
  --border: #27272a;
  --text: #e4e4e7;
  --text-heading: #fafafa;
  --text-muted: #a1a1aa;
  --text-faint: #71717a;
  --blue: #3b82f6;
  --amber: #f59e0b;
  --green: #22c55e;
  --red: #ef4444;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

header { margin-bottom: 2rem; }
h1 { font-size: 1.5rem; color: var(--text-heading); }
h2 { font-size: 1rem; color: var(--text-heading); margin-bottom: 0.75rem; }
.accent { color: var(--blue); }
.subtitle { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem; }
kbd {
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.card {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.card-header h2 { margin-bottom: 0; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.stat { background: var(--bg-muted); border-radius: 8px; padding: 0.75rem; }
.stat-label {
  display: block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-faint);
}
.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-heading);
  margin-top: 0.25rem;
}
.stat-change { font-size: 0.7rem; }
.stat-change.positive { color: var(--green); }
.stat-change.warning { color: var(--amber); }

.progress-track {
  height: 8px;
  background: var(--bg);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.5rem;
}
.progress-fill {
  height: 100%;
  background: var(--blue);
  border-radius: 4px;
  transition: width 0.4s ease;
}

table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
th {
  text-align: left;
  color: var(--text-faint);
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
}
tr:hover { background: var(--bg-muted); }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  transition: all 0.3s;
}
.badge.info { background: rgba(59, 130, 246, 0.1); color: var(--blue); }
.badge.warning { background: rgba(245, 158, 11, 0.1); color: var(--amber); }
.badge.success { background: rgba(34, 197, 94, 0.1); color: var(--green); }

.btn-primary {
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary:hover { filter: brightness(1.15); }

.btn-secondary {
  background: var(--bg-muted);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.75rem;
  cursor: pointer;
}
.btn-secondary:hover { border-color: var(--text-faint); color: var(--text); }

.popover {
  margin-top: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-muted);
  overflow: hidden;
  transition: all 0.2s;
}
.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border);
}
.popover-item:last-child { border-bottom: none; }
.popover-item small { margin-left: auto; color: var(--text-faint); font-size: 0.65rem; }

.dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot.blue { background: var(--blue); }
.dot.amber { background: var(--amber); }
.dot.green { background: var(--green); }

.skeleton-line {
  height: 10px;
  border-radius: 4px;
  background: var(--bg-muted);
  margin-bottom: 8px;
  animation: pulse 1.5s infinite;
}
.skeleton-line.wide { width: 100%; }
.skeleton-line.medium { width: 75%; }
.skeleton-line.narrow { width: 50%; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
