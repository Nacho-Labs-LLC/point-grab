import { useState, useEffect } from 'react';
import { usePointGrab } from '@point-grab/react';
import './App.css';

function App() {
  usePointGrab({ activationMode: 'hold' });

  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [skeletonLoaded, setSkeletonLoaded] = useState(false);

  const statuses = ['Syncing...', 'Validating', 'Confirmed'];
  const statusTypes = ['info', 'warning', 'success'];

  // Progress bar animation: fills to ~87% then resets
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 87 ? 0 : prev + 3));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Status badge cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Skeleton loader toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setSkeletonLoaded((prev) => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">
            <span className="logo-icon">◎</span> pointgrab
            <span className="logo-tag">react</span>
          </h1>
          <p className="instructions">
            Hold <kbd>Cmd+C</kbd> (Mac) or <kbd>Ctrl+C</kbd> (Win) and hover
            over any element. Click to capture. Press <kbd>F</kbd> to freeze
            animations.
          </p>
        </div>
      </header>

      <main className="main">
        {/* Stats Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Active Users</span>
            <span className="stat-value">2,847</span>
            <span className="stat-change positive">+12.5%</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Revenue</span>
            <span className="stat-value">$48.2k</span>
            <span className="stat-change positive">+8.1%</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Conversion</span>
            <span className="stat-value">3.24%</span>
            <span className="stat-change negative">-0.4%</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg. Session</span>
            <span className="stat-value">4m 32s</span>
            <span className="stat-change positive">+18s</span>
          </div>
        </section>

        <div className="grid-2col">
          {/* Progress Card */}
          <div className="card">
            <div className="card-header">
              <h2>Deployment Progress</h2>
              <span className="badge info">In Progress</span>
            </div>
            <div className="card-body">
              <div className="progress-info">
                <span>Building assets...</span>
                <span className="progress-value">{progress}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="progress-steps">
                <span className={progress > 20 ? 'step done' : 'step'}>Install</span>
                <span className={progress > 50 ? 'step done' : 'step active'}>Build</span>
                <span className={progress > 80 ? 'step done' : 'step'}>Deploy</span>
              </div>
            </div>
          </div>

          {/* Notification Popover Card */}
          <div className="card">
            <div className="card-header">
              <h2>Notifications</h2>
              <div className="popover-wrapper">
                <button
                  className="btn-icon"
                  onClick={() => setPopoverOpen(!popoverOpen)}
                >
                  🔔 <span className="notif-dot" />
                </button>
                {popoverOpen && (
                  <div className="popover">
                    <div className="popover-item">
                      <span className="popover-dot blue" />
                      <div>
                        <strong>Deploy succeeded</strong>
                        <p>Production v2.4.1 is live</p>
                      </div>
                    </div>
                    <div className="popover-item">
                      <span className="popover-dot amber" />
                      <div>
                        <strong>CPU usage spike</strong>
                        <p>Server us-east-1 at 89%</p>
                      </div>
                    </div>
                    <div className="popover-item">
                      <span className="popover-dot green" />
                      <div>
                        <strong>New signup</strong>
                        <p>user@example.com joined</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Click the bell icon to toggle the notification popover. With
                pointgrab active, press <kbd>F</kbd> to freeze and inspect
                transient UI.
              </p>
            </div>
          </div>
        </div>

        <div className="grid-2col">
          {/* Table Card */}
          <div className="card">
            <div className="card-header">
              <h2>Recent Transactions</h2>
            </div>
            <div className="card-body no-padding">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono">#TXN-4821</td>
                    <td>$1,240.00</td>
                    <td>
                      <span className={`badge ${statusTypes[statusIndex]}`}>
                        {statuses[statusIndex]}
                      </span>
                    </td>
                    <td className="text-muted">May 2, 2026</td>
                  </tr>
                  <tr>
                    <td className="mono">#TXN-4820</td>
                    <td>$890.50</td>
                    <td>
                      <span className="badge success">Confirmed</span>
                    </td>
                    <td className="text-muted">May 1, 2026</td>
                  </tr>
                  <tr>
                    <td className="mono">#TXN-4819</td>
                    <td>$2,100.00</td>
                    <td>
                      <span className="badge success">Confirmed</span>
                    </td>
                    <td className="text-muted">Apr 30, 2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Skeleton Loader Card */}
          <div className="card">
            <div className="card-header">
              <h2>User Profile</h2>
              <span className={`badge ${skeletonLoaded ? 'success' : 'warning'}`}>
                {skeletonLoaded ? 'Loaded' : 'Loading...'}
              </span>
            </div>
            <div className="card-body">
              {skeletonLoaded ? (
                <div className="profile">
                  <div className="avatar">NR</div>
                  <div className="profile-info">
                    <strong>Nate Richardson</strong>
                    <p className="text-muted">nate@example.com</p>
                    <p className="text-faint">Senior Engineer · San Francisco</p>
                  </div>
                </div>
              ) : (
                <div className="skeleton-group">
                  <div className="skeleton skeleton-avatar" />
                  <div className="skeleton-lines">
                    <div className="skeleton skeleton-line wide" />
                    <div className="skeleton skeleton-line medium" />
                    <div className="skeleton skeleton-line narrow" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
