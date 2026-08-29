/**
 * Companies Page — placeholder for Phase 2.
 */

import { Building2 } from 'lucide-react';

export default function CompaniesPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">Manage your client companies</p>
        </div>
      </div>

      <div className="empty-state">
        <Building2 size={48} className="empty-state-icon" />
        <div className="empty-state-title">No companies yet</div>
        <p className="empty-state-text">Companies will be built in Phase 2</p>
      </div>
    </div>
  );
}
