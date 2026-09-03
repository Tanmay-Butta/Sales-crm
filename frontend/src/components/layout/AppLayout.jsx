/**
 * App Layout — sidebar + navbar + content wrapper.
 * Wraps all authenticated pages with dynamic past-due alert count badge syncing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { alertsAPI } from '../../api/alerts';

export default function AppLayout() {
  const { user } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const lastFetchRef = useRef(0);

  const fetchAlertCount = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    // Throttle to at most once per 2 seconds to prevent burst requests
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    try {
      const res = await alertsAPI.getAlertsCount();
      setAlertCount(res.data.count || 0);
    } catch (err) {
      console.error('[Alerts Count Error]', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    // Defer initial alert count fetch by 800ms so important page content
    // (Deals, Dashboard, Companies) fires first and renders immediately
    const initialTimer = setTimeout(() => {
      fetchAlertCount();
    }, 800);

    // Listen for custom broadcast events across pages (deal state changes, dismissals, etc.)
    const handleSync = () => fetchAlertCount();
    window.addEventListener('deals-updated', handleSync);
    window.addEventListener('alerts-updated', handleSync);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('deals-updated', handleSync);
      window.removeEventListener('alerts-updated', handleSync);
    };
  }, [user?.id, fetchAlertCount]);

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
