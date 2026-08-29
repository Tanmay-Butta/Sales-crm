/**
 * My Deals Page — placeholder for Phase 4.
 */

import { ListTodo } from 'lucide-react';

export default function MyDealsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Deals</h1>
          <p className="page-subtitle">Deals you own or collaborate on</p>
        </div>
      </div>

      <div className="empty-state">
        <ListTodo size={48} className="empty-state-icon" />
        <div className="empty-state-title">No deals assigned</div>
        <p className="empty-state-text">My Deals will be built in Phase 4</p>
      </div>
    </div>
  );
}
