/**
 * App Layout — sidebar + navbar + content wrapper.
 * Wraps all authenticated pages with dynamic past-due alert count badge syncing.
 */

import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { alertsAPI } from '../../api/alerts';

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [alertCount, setAlertCount] = useState(0);

  const fetchAlertCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await alertsAPI.getAlertsCount();
      setAlertCount(res.data.count || 0);
    } catch (err) {
      console.error('[Alerts Count Error]', err);
    }
  }, [user]);

  useEffect(() => {
    fetchAlertCount();

    // Listen for custom broadcast events across pages (deal state changes, dismissals, etc.)
    const handleSync = () => fetchAlertCount();
    window.addEventListener('deals-updated', handleSync);
    window.addEventListener('alerts-updated', handleSync);

    // Periodic check every 30s
    const interval = setInterval(fetchAlertCount, 30000);

    return () => {
      window.removeEventListener('deals-updated', handleSync);
      window.removeEventListener('alerts-updated', handleSync);
      clearInterval(interval);
    };
  }, [fetchAlertCount, location.pathname]);

  return (
    <div className="app-layout">
      <Sidebar alertCount={alertCount} />
      <div className="app-main">
        <header className="app-navbar">
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              {getGreeting()}, {user?.full_name?.split(' ')[0]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-gray" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
              {user?.role === 'SALES_MANAGER' ? 'Sales Manager' : 'Sales Rep'}
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
