/**
 * Sidebar navigation — role-aware links, alert badge, user info.
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Handshake,
  ListTodo,
  Bell,
  LogOut,
  X
} from 'lucide-react';

export default function Sidebar({ alertCount = 0, isOpen = false, setIsOpen = () => {} }) {
  const { user, isManager, logout } = useAuth();

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Sales CRM</h1>
          <span>Pipeline Management</span>
        </div>
        <button 
          className="mobile-menu-btn" 
          onClick={() => setIsOpen(false)}
          style={{ margin: 0, padding: '4px' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main</div>

        <NavLink
          to="/"
          end
          onClick={() => setIsOpen(false)}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>

        <NavLink
          to="/companies"
          onClick={() => setIsOpen(false)}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <Building2 size={18} />
          Companies
        </NavLink>

        <NavLink
          to="/deals"
          onClick={() => setIsOpen(false)}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <Handshake size={18} />
          {isManager ? 'Deals Pipeline' : 'All Deals'}
        </NavLink>

        {!isManager && (
          <NavLink
            to="/my-deals"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <ListTodo size={18} />
            My Deals
          </NavLink>
        )}

        <div className="sidebar-section-label">Notifications</div>

        <NavLink
          to="/alerts"
          onClick={() => setIsOpen(false)}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <Bell size={18} />
          Alerts
          {alertCount > 0 && <span className="badge">{alertCount}</span>}
        </NavLink>
      </nav>

      {/* User Info */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.full_name}</div>
          <div className="sidebar-user-role">
            {isManager ? 'Sales Manager' : 'Sales Rep'}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={logout}
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
