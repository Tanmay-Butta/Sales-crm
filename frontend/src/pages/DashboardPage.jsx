/**
 * Dashboard Page — placeholder for Phase 8.
 */

import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your sales pipeline</p>
        </div>
      </div>

      <div className="grid-4">
        <div className="stat-card" style={{ '--accent': 'var(--color-primary)' }}>
          <div className="stat-card-label">Open Deals</div>
          <div className="stat-card-value">—</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--color-success)' }}>
          <div className="stat-card-label">Weighted Pipeline</div>
          <div className="stat-card-value">—</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--stage-won)' }}>
          <div className="stat-card-label">Won This Month</div>
          <div className="stat-card-value">—</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--color-danger)' }}>
          <div className="stat-card-label">Lost This Month</div>
          <div className="stat-card-value">—</div>
        </div>
      </div>

      <div className="empty-state" style={{ marginTop: '48px' }}>
        <LayoutDashboard size={48} className="empty-state-icon" />
        <div className="empty-state-title">Dashboard coming soon</div>
        <p className="empty-state-text">
          Charts and breakdowns will be built in Phase 8
        </p>
      </div>
    </div>
  );
}
