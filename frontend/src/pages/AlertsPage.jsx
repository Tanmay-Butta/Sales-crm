/**
 * Alerts Page (Goal 10) — Clean, Uncluttered & Expandable Overdue Opportunities.
 * Features:
 * 1. Clean, spaced cards showing high-signal information initially.
 * 2. An arrow toggle on each card that smoothly expands quick options (Reschedule, Timeline, Stage).
 * 3. Quick date extender (+7d, +14d, +30d presets or custom date).
 * 4. Rich, fully interactive Deal Timeline modal matching My Deals with Note creation.
 * 5. Stateless dismissal with real-time navigation badge sync.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  BellOff, 
  CalendarPlus, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Building2, 
  User, 
  History, 
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  RotateCcw,
  UserCheck,
  UserPlus,
  UserMinus,
  MessageSquare,
  CalendarCheck
} from 'lucide-react';
import { alertsAPI } from '../api/alerts';
import { dealsAPI } from '../api/deals';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingId, setDismissingId] = useState(null);

  // Expandable Drawer State (stores currently expanded deal ID)
  const [expandedDealId, setExpandedDealId] = useState(null);

  // Quick Reschedule State per deal
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [reschedulingId, setReschedulingId] = useState(null);

  // History Modal State & Note adding state
  const [historyModalDeal, setHistoryModalDeal] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchAlerts = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await alertsAPI.getAlerts();
      setAlerts(res.data.alerts || []);
      window.dispatchEvent(new Event('alerts-updated'));
    } catch (err) {
      console.error('[Fetch Alerts Error]', err);
      toast.error('Failed to load past-due alerts');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Toggle Drawer
  const toggleExpand = (dealId) => {
    if (expandedDealId === dealId) {
      setExpandedDealId(null);
    } else {
      setExpandedDealId(dealId);
      // Default suggested date: 7 days from today
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setRescheduleDate(d.toISOString().split('T')[0]);
    }
  };

  // Quick Presets for Date (+7, +14, +30 days from today)
  const applyPresetDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setRescheduleDate(d.toISOString().split('T')[0]);
  };

  // Submit Reschedule / Extend Date
  const handleRescheduleSubmit = async (dealId) => {
    if (!rescheduleDate) return;
    setReschedulingId(dealId);
    try {
      await dealsAPI.updateDeal(dealId, {
        expected_close_date: rescheduleDate
      });
      toast.success(`Expected close date updated to ${rescheduleDate}`);
      setExpandedDealId(null);
      fetchAlerts();
      window.dispatchEvent(new Event('deals-updated'));
    } catch (err) {
      console.error('[Reschedule Error]', err);
      toast.error(err.response?.data?.error?.message || 'Failed to update expected close date');
    } finally {
      setReschedulingId(null);
    }
  };

  // Handle Dismissal (Deal Owner or Manager only)
  const handleDismiss = async (deal) => {
    if (!deal.can_dismiss) {
      toast.error('Only the deal owner or a sales manager can dismiss this alert');
      return;
    }

    setDismissingId(deal.deal_id);
    try {
      await alertsAPI.dismissAlert(deal.deal_id);
      toast.success(`Alert for "${deal.title}" dismissed`);
      setAlerts(prev => prev.filter(a => a.deal_id !== deal.deal_id));
      if (expandedDealId === deal.deal_id) setExpandedDealId(null);
      window.dispatchEvent(new Event('alerts-updated'));
    } catch (err) {
      console.error('[Dismiss Alert Error]', err);
      toast.error(err.response?.data?.error?.message || 'Failed to dismiss alert');
    } finally {
      setDismissingId(null);
    }
  };

  // Open History Modal
  const openHistoryModal = async (deal) => {
    setHistoryModalDeal(deal);
    setNoteText("");
    setHistoryLoading(true);
    try {
      const res = await dealsAPI.getHistory(deal.deal_id);
      setHistoryEvents(res.data.history || []);
    } catch (err) {
      console.error('[Fetch History Error]', err);
      toast.error('Failed to load deal history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Add Note Handler
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim() || !historyModalDeal) return;

    setNoteSubmitting(true);
    try {
      await dealsAPI.addNote(historyModalDeal.deal_id, noteText.trim());
      toast.success("Note added to timeline");
      setNoteText("");
      const res = await dealsAPI.getHistory(historyModalDeal.deal_id);
      setHistoryEvents(res.data.history || []);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to add note");
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Format Currency into Indian Rupees (INR)
  const formatINR = (val) => {
    const num = parseFloat(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const getStageBadgeClass = (stage) => {
    const map = {
      NEW: 'badge-blue',
      QUALIFIED: 'badge-purple',
      PROPOSAL: 'badge-yellow',
      NEGOTIATION: 'badge-orange'
    };
    return map[stage] || 'badge-gray';
  };

  const totalOverdueValue = alerts.reduce((sum, a) => sum + parseFloat(a.value || 0), 0);
  const avgDaysOverdue = alerts.length > 0 
    ? Math.round(alerts.reduce((sum, a) => sum + a.days_overdue, 0) / alerts.length) 
    : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px', gap: '12px' }}>
        <div style={{ width: '38px', height: '38px', border: '3px solid rgba(255, 255, 255, 0.08)', borderTopColor: '#f87171', borderRadius: '50%', animation: 'spin 0.9s cubic-bezier(0.6, 0.2, 0.4, 0.8) infinite' }} />
        <span style={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 500 }}>
          Scanning pipeline for past-due opportunities...
        </span>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header Banner */}
      <div
        className="glass-card-exponential"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
              Past-Due Deal Alerts
            </h1>

            <span
              className="glass-pill"
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: alerts.length > 0 ? '#f87171' : '#34d399',
                borderColor: alerts.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(52, 211, 153, 0.3)'
              }}
            >
              {alerts.length > 0 ? (
                <>
                  <AlertTriangle size={11} style={{ color: '#f87171' }} /> {alerts.length} Overdue {alerts.length === 1 ? 'Deal' : 'Deals'}
                </>
              ) : (
                <>
                  <CheckCircle2 size={11} style={{ color: '#34d399' }} /> All Caught Up
                </>
              )}
            </span>
          </div>

          <p style={{ fontSize: '0.775rem', color: '#94a3b8', margin: 0 }}>
            Open opportunities whose expected close date has passed without closure
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAlerts(true)}
            disabled={refreshing}
            style={{
              borderRadius: '8px',
              padding: '5px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.75rem'
            }}
          >
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards Strip (Compact 3-column row) */}
      <div className="grid-3" style={{ gap: '12px' }}>
        {/* Metric 1: Total Overdue */}
        <div 
          className="glass-card-exponential" 
          style={{ 
            padding: '12px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            borderRadius: '14px'
          }}
        >
          <div className="glass-icon-container" style={{ width: '34px', height: '34px', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.25)', flexShrink: 0 }}>
            <Clock size={15} style={{ color: '#f87171' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: alerts.length > 0 ? '#f87171' : '#ffffff', lineHeight: 1.1 }}>
              {alerts.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>
              Active Past-Due Alerts
            </div>
          </div>
        </div>

        {/* Metric 2: Overdue Pipeline Value */}
        <div 
          className="glass-card-exponential" 
          style={{ 
            padding: '12px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            borderRadius: '14px'
          }}
        >
          <div className="glass-icon-container" style={{ width: '34px', height: '34px', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.25)', flexShrink: 0 }}>
            <Layers size={15} style={{ color: '#fbbf24' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', lineHeight: 1.1 }}>
              {formatINR(totalOverdueValue)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>
              Total Overdue Pipeline
            </div>
          </div>
        </div>

        {/* Metric 3: Avg Days Overdue */}
        <div 
          className="glass-card-exponential" 
          style={{ 
            padding: '12px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            borderRadius: '14px'
          }}
        >
          <div className="glass-icon-container" style={{ width: '34px', height: '34px', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.25)', flexShrink: 0 }}>
            <Calendar size={15} style={{ color: '#818cf8' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
              {avgDaysOverdue} {avgDaysOverdue === 1 ? 'day' : 'days'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>
              Mean Overdue Delay
            </div>
          </div>
        </div>
      </div>

      {/* 3. Distinct, Separated Overdue Deal Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.length === 0 ? (
          <div className="glass-card-exponential" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2) 0%, rgba(52, 211, 153, 0.05) 100%)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <CheckCircle2 size={24} style={{ color: '#34d399' }} />
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
              All Caught Up!
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '380px', margin: '4px auto 0' }}>
              No active past-due deal alerts. All open opportunities are within their expected close dates.
            </p>
          </div>
        ) : (
          alerts.map((deal) => {
            const isExpanded = expandedDealId === deal.deal_id;

            return (
              <div
                key={deal.deal_id}
                className="glass-card-exponential"
                style={{
                  padding: 0,
                  borderRadius: '16px',
                  border: isExpanded ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
                  background: isExpanded 
                    ? 'linear-gradient(145deg, rgba(30, 35, 52, 0.9) 0%, rgba(18, 21, 31, 0.9) 100%)' 
                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%), rgba(19, 22, 33, 0.8)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Main Visible Strip (Clean & High-Signal) */}
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}
                >
                  {/* Left: Overdue Tag + Deal Title & Company */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 320px', minWidth: '260px' }}>
                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: '8px',
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Clock size={12} />
                      {deal.days_overdue}d Overdue
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.925rem', letterSpacing: '-0.01em' }}>
                        {deal.title}
                      </span>
                      {deal.company && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <Building2 size={12} />
                          <span>{deal.company.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Stage + Value + Expected Date + Owner */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Stage Badge */}
                    <span className={`badge ${getStageBadgeClass(deal.stage)}`} style={{ fontSize: '0.7rem' }}>
                      {deal.stage}
                    </span>

                    {/* Value */}
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', minWidth: '85px' }}>
                      {formatINR(deal.value)}
                    </div>

                    {/* Expected Date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.775rem', color: '#cbd5e1' }}>
                      <Calendar size={12} style={{ color: '#94a3b8' }} />
                      <span>{deal.expected_close_date}</span>
                    </div>

                    {/* Owner */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.775rem', color: '#e2e8f0' }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.25)',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#a5b4fc'
                        }}
                      >
                        {deal.owner?.full_name?.charAt(0) || 'U'}
                      </div>
                      <span>{deal.owner?.full_name}</span>
                    </div>
                  </div>

                  {/* Right Actions: Dismiss button + Quick Options Toggle Arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Dismiss Button */}
                    <button
                      className={`btn btn-sm ${deal.can_dismiss ? 'btn-secondary' : 'btn-disabled'}`}
                      onClick={() => handleDismiss(deal)}
                      disabled={!deal.can_dismiss || dismissingId === deal.deal_id}
                      title={deal.can_dismiss ? "Dismiss alert for this close date" : "Only the deal owner or sales manager can dismiss"}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        borderColor: deal.can_dismiss ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.05)',
                        color: deal.can_dismiss ? '#f87171' : '#64748b'
                      }}
                    >
                      <BellOff size={12} />
                      <span>{dismissingId === deal.deal_id ? 'Dismissing...' : 'Dismiss'}</span>
                    </button>

                    {/* Options Toggle Arrow */}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleExpand(deal.deal_id)}
                      title={isExpanded ? "Collapse options" : "Expand quick options"}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        background: isExpanded ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        borderColor: isExpanded ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <span style={{ color: isExpanded ? '#a5b4fc' : '#94a3b8' }}>Options</span>
                      {isExpanded ? <ChevronUp size={14} style={{ color: '#a5b4fc' }} /> : <ChevronDown size={14} style={{ color: '#94a3b8' }} />}
                    </button>
                  </div>
                </div>

                {/* 4. Expandable Quick Options Drawer */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      background: 'rgba(15, 17, 26, 0.75)',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                      borderBottomLeftRadius: '16px',
                      borderBottomRightRadius: '16px'
                    }}
                  >
                    {/* Quick Reschedule Section */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CalendarPlus size={14} style={{ color: '#38bdf8' }} /> Reschedule To:
                      </span>

                      {/* Quick Presets */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => applyPresetDays(7)}
                          style={{ padding: '3px 8px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          +7 Days
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => applyPresetDays(14)}
                          style={{ padding: '3px 8px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          +14 Days
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => applyPresetDays(30)}
                          style={{ padding: '3px 8px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          +30 Days
                        </button>
                      </div>

                      {/* Custom Date Input */}
                      <input
                        type="date"
                        className="form-input"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        style={{ padding: '3px 8px', fontSize: '0.75rem', height: '30px', width: '135px' }}
                      />

                      {/* Save Date Button */}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRescheduleSubmit(deal.deal_id)}
                        disabled={reschedulingId === deal.deal_id || !rescheduleDate}
                        style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                      >
                        <CalendarCheck size={12} />
                        <span>{reschedulingId === deal.deal_id ? 'Saving...' : 'Save Date'}</span>
                      </button>
                    </div>

                    {/* Timeline Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openHistoryModal(deal)}
                        style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                      >
                        <History size={13} style={{ color: '#818cf8' }} />
                        <span>View Deal Timeline</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Rich History Timeline Modal (Matches My Deals Modal exactly) */}
      {historyModalDeal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setHistoryModalDeal(null); }}>
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} />
                  Deal Timeline
                </h3>
                <p className="text-muted text-xs mt-1">{historyModalDeal.title} &mdash; Immutable audit trail</p>
              </div>
              <button className="modal-close" onClick={() => setHistoryModalDeal(null)}>✕</button>
            </div>
            
            {/* Add Note Input */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Add a note to this deal..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  maxLength={2000}
                  style={{ flex: 1 }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={noteSubmitting || !noteText.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {noteSubmitting ? 'Adding...' : 'Add Note'}
                </button>
              </form>
            </div>

            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {historyLoading ? (
                <div className="text-center p-4 text-muted">Loading timeline...</div>
              ) : historyEvents.length === 0 ? (
                <div className="text-muted text-center p-4">No timeline events yet. Add a note to get started.</div>
              ) : (
                <div style={{ position: 'relative', padding: '8px 4px' }}>
                  {historyEvents.map((h, idx) => {
                    const isLast = idx === historyEvents.length - 1;
                    
                    let icon = <History size={14} style={{ color: '#818cf8' }} />;
                    let actionElement = null;
                    let badgeBg = 'rgba(99, 102, 241, 0.12)';
                    let badgeBorder = 'rgba(99, 102, 241, 0.3)';

                    if (h.event_type === 'DEAL_CREATED') {
                      icon = <Sparkles size={14} style={{ color: '#38bdf8' }} />;
                      badgeBg = 'rgba(56, 189, 248, 0.12)';
                      badgeBorder = 'rgba(56, 189, 248, 0.3)';
                      actionElement = (
                        <span>created deal in <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span> stage with value <strong>₹{Number(h.new_value?.value || 0).toLocaleString('en-IN')}</strong></span>
                      );
                    } else if (h.event_type === 'STAGE_CHANGED') {
                      icon = <ArrowRight size={14} style={{ color: '#818cf8' }} />;
                      badgeBg = 'rgba(129, 140, 248, 0.12)';
                      badgeBorder = 'rgba(129, 140, 248, 0.3)';
                      actionElement = (
                        <span>advanced stage from <span className={`badge badge-${h.old_value?.stage?.toLowerCase()}`}>{h.old_value?.stage}</span> to <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span></span>
                      );
                    } else if (h.event_type === 'STAGE_BACKWARD') {
                      icon = <RotateCcw size={14} style={{ color: '#fbbf24' }} />;
                      badgeBg = 'rgba(251, 191, 36, 0.12)';
                      badgeBorder = 'rgba(251, 191, 36, 0.3)';
                      actionElement = (
                        <span>moved stage backward from <span className={`badge badge-${h.old_value?.stage?.toLowerCase()}`}>{h.old_value?.stage}</span> to <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span></span>
                      );
                    } else if (h.event_type === 'DEAL_CLOSED') {
                      const isWon = h.new_value?.stage === 'WON';
                      icon = isWon ? <CheckCircle2 size={14} style={{ color: '#34d399' }} /> : <XCircle size={14} style={{ color: '#f87171' }} />;
                      badgeBg = isWon ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)';
                      badgeBorder = isWon ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)';
                      actionElement = (
                        <span>closed deal as <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span> <span className="text-muted text-xs">(last stage was {h.old_value?.stage})</span></span>
                      );
                    } else if (h.event_type === 'DEAL_REOPENED') {
                      icon = <RotateCcw size={14} style={{ color: '#a78bfa' }} />;
                      badgeBg = 'rgba(167, 139, 250, 0.12)';
                      badgeBorder = 'rgba(167, 139, 250, 0.3)';
                      actionElement = (
                        <span>reopened deal to <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span> stage</span>
                      );
                    } else if (h.event_type === 'OWNER_CHANGED') {
                      icon = <UserCheck size={14} style={{ color: '#22d3ee' }} />;
                      badgeBg = 'rgba(34, 211, 238, 0.12)';
                      badgeBorder = 'rgba(34, 211, 238, 0.3)';
                      actionElement = (
                        <span>reassigned owner to <strong>{h.new_value?.owner_name || `User #${h.new_value?.owner_id}`}</strong> <span className="text-muted text-xs">(previous: {h.old_value?.owner_name || `User #${h.old_value?.owner_id}`})</span></span>
                      );
                    } else if (h.event_type === 'COLLABORATOR_ADDED') {
                      icon = <UserPlus size={14} style={{ color: '#2dd4bf' }} />;
                      badgeBg = 'rgba(45, 212, 191, 0.12)';
                      badgeBorder = 'rgba(45, 212, 191, 0.3)';
                      actionElement = (
                        <span>added collaborator <strong>{h.new_value?.user_name}</strong>{h.new_value?.note ? ` (${h.new_value.note})` : ''}</span>
                      );
                    } else if (h.event_type === 'COLLABORATOR_REMOVED') {
                      icon = <UserMinus size={14} style={{ color: '#94a3b8' }} />;
                      badgeBg = 'rgba(148, 163, 184, 0.12)';
                      badgeBorder = 'rgba(148, 163, 184, 0.3)';
                      actionElement = (
                        <span>removed collaborator <strong>{h.old_value?.user_name}</strong></span>
                      );
                    } else if (h.event_type === 'NOTE_ADDED') {
                      icon = <MessageSquare size={14} style={{ color: '#818cf8' }} />;
                      badgeBg = 'rgba(129, 140, 248, 0.12)';
                      badgeBorder = 'rgba(129, 140, 248, 0.3)';
                      actionElement = <span>added a note</span>;
                    }

                    const rawDate = h.created_at ? (h.created_at.endsWith('Z') || h.created_at.includes('+') ? h.created_at : h.created_at + 'Z') : new Date().toISOString();
                    const dateObj = new Date(rawDate);
                    const timeStr = dateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
                    const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

                    return (
                      <div key={h.id} style={{ position: 'relative', display: 'flex', gap: '14px', paddingBottom: isLast ? '6px' : '22px' }}>
                        {/* Connecting vertical line */}
                        {!isLast && (
                          <div style={{
                            position: 'absolute',
                            left: '15px',
                            top: '30px',
                            bottom: '0',
                            width: '2px',
                            background: 'var(--color-border)'
                          }} />
                        )}

                        {/* Icon Node */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          zIndex: 1
                        }}>
                          {icon}
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Fixed Header Row: Author on left, Timestamp pill on right */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              {h.actor?.full_name || `User #${h.actor_id}`}
                            </span>
                            <span style={{ 
                              fontSize: '0.8rem', 
                              background: 'var(--color-bg-tertiary)', 
                              border: '1px solid var(--color-border)', 
                              padding: '2px 9px', 
                              borderRadius: '6px', 
                              whiteSpace: 'nowrap', 
                              marginLeft: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <strong style={{ color: 'var(--color-text)', fontSize: '0.825rem' }}>{timeStr}</strong>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.725rem' }}>{dateStr}</span>
                            </span>
                          </div>

                          {/* Action Subtitle (for non-notes or lifecycle actions) */}
                          {h.event_type !== 'NOTE_ADDED' && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                              {actionElement}
                            </div>
                          )}

                          {/* Note Card */}
                          {h.event_type === 'NOTE_ADDED' && h.new_value?.note && (
                            <div style={{
                              marginTop: '4px',
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              fontSize: '0.875rem',
                              color: 'var(--color-text)',
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                              {h.new_value.note}
                            </div>
                          )}

                          {/* Backward Stage Reason */}
                          {h.event_type === 'STAGE_BACKWARD' && h.reason && (
                            <div style={{
                              marginTop: '6px',
                              background: 'rgba(245, 158, 11, 0.08)',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.825rem',
                              color: '#fbbf24',
                              borderLeft: '3px solid #f59e0b'
                            }}>
                              <strong>Reason:</strong> {h.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHistoryModalDeal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
