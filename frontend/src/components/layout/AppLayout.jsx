/**
 * App Layout — sidebar + navbar + content wrapper.
 * Wraps all authenticated pages.
 */

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar alertCount={0} />
      <div className="app-main">
        <header className="app-navbar">
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              {getGreeting()}, {user?.full_name?.split(' ')[0]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="text-sm text-muted">
              {user?.role === 'SALES_MANAGER' ? '👨‍💼 Manager' : '🧑‍💻 Sales Rep'}
            </span>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
