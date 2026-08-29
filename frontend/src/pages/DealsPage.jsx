/**
 * Deals Page — placeholder for Phase 6.
 */

import { Handshake } from 'lucide-react';

export default function DealsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Deals</h1>
          <p className="page-subtitle">Search, filter, and manage all deals</p>
        </div>
      </div>

      <div className="empty-state">
        <Handshake size={48} className="empty-state-icon" />
        <div className="empty-state-title">No deals yet</div>
        <p className="empty-state-text">Deal search will be built in Phase 6</p>
      </div>
    </div>
  );
}
