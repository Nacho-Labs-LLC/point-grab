<script>
  import { onMount } from 'svelte';
  import { point-grab } from '@point-grab/svelte';
  import './app.css';

  let progress = $state(0);
  let statusIndex = $state(0);
  let popoverOpen = $state(false);
  let skeletonLoaded = $state(false);

  const statuses = [
    { label: 'Syncing...', cls: 'badge-info' },
    { label: 'Validating', cls: 'badge-warning' },
    { label: 'Confirmed', cls: 'badge-success' },
  ];

  let currentStatus = $derived(statuses[statusIndex]);

  onMount(() => {
    const progressInterval = setInterval(() => {
      progress += 2;
      if (progress > 87) progress = 0;
    }, 400);

    const statusInterval = setInterval(() => {
      statusIndex = (statusIndex + 1) % statuses.length;
    }, 2500);

    const skeletonInterval = setInterval(() => {
      skeletonLoaded = !skeletonLoaded;
    }, 4000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      clearInterval(skeletonInterval);
    };
  });
</script>

<div use:point-grab={{ activationMode: 'hold' }}>
  <header class="header">
    <h1>point-grab — Svelte Example</h1>
    <p>
      Hold Cmd+C (Mac) or Ctrl+C (Win) and hover over any element. Click to capture. Press F to freeze animations.
    </p>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Revenue</div>
      <div class="stat-value">$48.2k</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Orders</div>
      <div class="stat-value">1,284</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Conversion</div>
      <div class="stat-value">3.6%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg. Time</div>
      <div class="stat-value">2m 14s</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Upload Progress</div>
    <div class="progress-container">
      <div class="progress-label">
        <span>Processing batch...</span>
        <span>{progress}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Recent Transactions</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>#4091</td>
            <td>Sarah Chen</td>
            <td>$1,240.00</td>
            <td><span class="badge {currentStatus.cls}">{currentStatus.label}</span></td>
          </tr>
          <tr>
            <td>#4090</td>
            <td>Marcus Rivera</td>
            <td>$890.50</td>
            <td><span class="badge badge-success">Confirmed</span></td>
          </tr>
          <tr>
            <td>#4089</td>
            <td>Aiko Tanaka</td>
            <td>$2,100.00</td>
            <td><span class="badge badge-success">Confirmed</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Notifications</div>
    <div class="notification-area">
      <button class="notification-btn" onclick={() => popoverOpen = !popoverOpen}>
        {popoverOpen ? 'Hide' : 'Show'} Notifications (3)
      </button>

      {#if popoverOpen}
        <div class="popover">
          <div class="popover-item">
            <strong>Deployment complete</strong>
            Production v2.4.1 rolled out successfully.
          </div>
          <div class="popover-item">
            <strong>New team member</strong>
            Jordan Lee joined the workspace.
          </div>
          <div class="popover-item">
            <strong>Billing alert</strong>
            Usage approaching 80% of plan limit.
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Team Members</div>

    {#if !skeletonLoaded}
      <div class="skeleton-row">
        <div class="skeleton-circle"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
      <div class="skeleton-row">
        <div class="skeleton-circle"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    {:else}
      <div class="loaded-row">
        <div class="loaded-avatar">AK</div>
        <div class="loaded-text">
          <strong>Alex Kim</strong>
          <p>Engineering Lead — Last active 2m ago</p>
        </div>
      </div>
      <div class="loaded-row">
        <div class="loaded-avatar">MP</div>
        <div class="loaded-text">
          <strong>Maya Patel</strong>
          <p>Product Designer — Last active 15m ago</p>
        </div>
      </div>
    {/if}
  </div>
</div>
