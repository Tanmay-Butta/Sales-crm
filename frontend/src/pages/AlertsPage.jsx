/**
 * Alerts Page — placeholder for Phase 9.
 */

import { Bell } from 'lucide-react';

export default function AlertsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">Past-due deal notifications</p>
        </div>
      </div>

      <div className="empty-state">
        <Bell size={48} className="empty-state-icon" />
        <div className="empty-state-title">No alerts</div>
        <p className="empty-state-text">Alert system will be built in Phase 9</p>
      </div>
    </div>
  );
}
