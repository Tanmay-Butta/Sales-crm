/**
 * Dashboard Page (Goal 8) — Compact, Exponential Glassmorphic Edition.
 * Displays:
 * 1. 4 Headline Cards: Open Deals, Weighted Pipeline, Won This Month, Lost This Month
 * 2. Stage Breakdown (Open Deals only)
 * 3. Owner Breakdown (Open Deals only)
 * 4. Deals Won per week over the last 8 weeks (with zero-win weeks preserved)
 */

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Briefcase, 
  Award, 
  XCircle, 
  RefreshCw, 
  Layers, 
  Users, 
  Calendar,
  Shield,
  UserCheck,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../api/dashboard';
import toast from 'react-hot-toast';
import ShimmerLoader from '../components/common/ShimmerLoader';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await dashboardAPI.getDashboard();
      setData(res.data);
    } catch (err) {
      console.error('[Dashboard Error]', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Format currency into Indian Rupees (INR) with compact Lakh / Crore representation
  const formatINR = (amount, compact = false) => {
    const num = parseFloat(amount || 0);
    if (isNaN(num)) return '₹ 0';

    if (compact) {
      if (num >= 10000000) {
        return `₹ ${(num / 10000000).toFixed(2)} Cr`;
      }
      if (num >= 100000) {
        return `₹ ${(num / 100000).toFixed(2)} L`;
      }
      if (num >= 1000) {
        return `₹ ${(num / 1000).toFixed(1)} k`;
      }
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Curated stage themes with glass accents
  const getStageTheme = (stage) => {
    const themes = {
      NEW: {
        color: '#60a5fa',
        glow: 'rgba(96, 165, 250, 0.25)',
        gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
        bg: 'rgba(59, 130, 246, 0.12)',
        prob: '10%'
      },
      QUALIFIED: {
        color: '#c084fc',
        glow: 'rgba(192, 132, 252, 0.25)',
        gradient: 'linear-gradient(90deg, #8b5cf6, #c084fc)',
        bg: 'rgba(139, 92, 246, 0.12)',
        prob: '25%'
      },
      PROPOSAL: {
        color: '#fbbf24',
        glow: 'rgba(251, 191, 36, 0.25)',
        gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
        bg: 'rgba(245, 158, 11, 0.12)',
        prob: '50%'
      },
      NEGOTIATION: {
        color: '#fb923c',
        glow: 'rgba(251, 146, 60, 0.25)',
        gradient: 'linear-gradient(90deg, #ea580c, #fb923c)',
        bg: 'rgba(234, 88, 12, 0.12)',
        prob: '75%'
      }
    };
    return themes[stage] || {
      color: '#94a3b8',
      glow: 'rgba(148, 163, 184, 0.2)',
      gradient: 'linear-gradient(90deg, #64748b, #94a3b8)',
      bg: 'rgba(148, 163, 184, 0.1)',
      prob: '0%'
    };
  };

  // Custom Glassmorphic Tooltip for Recharts
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(18, 21, 33, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderTop: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '12px',
          padding: '10px 14px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
          fontSize: '0.8rem',
          minWidth: '170px'
        }}>
          <div style={{ fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Calendar size={13} style={{ color: '#38bdf8' }} />
            <span>{item.week} &middot; {item.full_label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#94a3b8' }}>Deals Won:</span>
            <strong style={{ color: item.count > 0 ? '#34d399' : '#64748b', fontSize: '0.85rem' }}>
              {item.count} {item.count === 1 ? 'deal' : 'deals'}
            </strong>
          </div>
          {item.count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '2px', fontSize: '0.75rem' }}>
              <span style={{ color: '#94a3b8' }}>Revenue:</span>
              <strong style={{ color: '#f8fafc' }}>{formatINR(item.total_value)}</strong>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const now = new Date();
  const currentMonthShort = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const currentMonthLong = now.toLocaleString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px' }}>
        <ShimmerLoader
          type="cards"
          messages={[
            'Connecting to analytics engine...',
            'Calculating open deals and weighted pipeline value...',
            'Aggregating stage distribution & owner performance...',
            'Almost ready! Assembling executive dashboard...'
          ]}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state" style={{ marginTop: '36px' }}>
        <XCircle size={40} className="empty-state-icon text-danger" />
        <div className="empty-state-title">Dashboard Unavailable</div>
        <p className="empty-state-text">Could not retrieve live metrics. Please check network connection or retry.</p>
        <button className="btn btn-primary btn-sm" onClick={() => fetchDashboard(true)} style={{ marginTop: '14px' }}>
          Retry
        </button>
      </div>
    );
  }

  const { headline, by_stage, by_owner, wins_by_week } = data;
  const maxStageCount = Math.max(...by_stage.map(s => s.count), 1);
  const maxOwnerCount = Math.max(...by_owner.map(o => o.count), 1);
  const total8WeekWins = wins_by_week.reduce((sum, w) => sum + w.count, 0);
  const total8WeekValue = wins_by_week.reduce((sum, w) => sum + parseFloat(w.total_value || 0), 0);

  // Calculate weighted conversion forecast percentage
  const totalPipeNum = parseFloat(headline.total_pipeline || 0);
  const weightedPipeNum = parseFloat(headline.weighted_pipeline || 0);
  const forecastRealizationRate = totalPipeNum > 0 ? ((weightedPipeNum / totalPipeNum) * 100).toFixed(1) : '0.0';

  return (
    <div className="dashboard-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Ambient background glow orbs for soft depth behind frosted glass */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />

      {/* 1. Header Glass Banner */}
      <div
        className="glass-card-exponential"
        style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
              Pipeline Dashboard
            </h1>

            {/* Glass Role Badge */}
            <span
              className="glass-pill"
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: user?.role === 'SALES_MANAGER' ? '#818cf8' : '#34d399',
                borderColor: user?.role === 'SALES_MANAGER' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'
              }}
            >
              {user?.role === 'SALES_MANAGER' ? (
                <>
                  <Shield size={11} style={{ color: '#818cf8' }} /> Manager Scope (All Deals)
                </>
              ) : (
                <>
                  <UserCheck size={11} style={{ color: '#34d399' }} /> Rep Scope (Visible Deals)
                </>
              )}
            </span>

            {/* Realization Rate Pill */}
            <span
              className="glass-pill"
              style={{
                fontSize: '0.7rem',
                fontWeight: 500,
                color: '#e2e8f0'
              }}
            >
              <Sparkles size={11} style={{ color: '#fbbf24' }} />
              Weighted Yield: <strong style={{ color: '#38bdf8', marginLeft: '2px' }}>{forecastRealizationRate}%</strong>
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
            Real-time pipeline overview, stage distribution, and weekly conversion velocity
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            style={{
              borderRadius: '10px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.775rem'
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 2. Four Exponential Glass Stat Cards (Slightly Smaller & Compact) */}
      <div className="grid-4" style={{ gap: '14px' }}>
        {/* Card 1: Open Deals */}
        <div
          className="glass-stat-card"
          style={{
            '--accent-glow': 'rgba(59, 130, 246, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="glass-icon-container" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(59, 130, 246, 0.04) 100%)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
              <Briefcase size={18} style={{ color: '#60a5fa' }} />
            </div>
            <span
              className="glass-pill"
              style={{
                fontSize: '0.65rem',
                color: '#60a5fa',
                padding: '1px 7px'
              }}
            >
              Active
            </span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {headline.open_deals}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>
              Open Deals
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
              <span>New to Negotiation</span>
            </div>
          </div>
        </div>

        {/* Card 2: Weighted Pipeline */}
        <div
          className="glass-stat-card"
          style={{
            '--accent-glow': 'rgba(16, 185, 129, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="glass-icon-container" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0.04) 100%)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
              <TrendingUp size={18} style={{ color: '#34d399' }} />
            </div>
            <span
              className="glass-pill"
              style={{
                fontSize: '0.65rem',
                color: '#34d399',
                padding: '1px 7px'
              }}
            >
              Forecast
            </span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div
              style={{ fontSize: '1.65rem', fontWeight: 700, color: '#34d399', letterSpacing: '-0.02em', lineHeight: 1.1 }}
              title={`Exact Weighted: ${formatINR(headline.weighted_pipeline)}`}
            >
              {formatINR(headline.weighted_pipeline, true)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>
              Weighted Pipeline
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total unweighted:</span>
              <strong style={{ color: '#cbd5e1' }}>{formatINR(headline.total_pipeline, true)}</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Won This Month */}
        <div
          className="glass-stat-card"
          style={{
            '--accent-glow': 'rgba(245, 158, 11, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="glass-icon-container" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.04) 100%)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
              <Award size={18} style={{ color: '#fbbf24' }} />
            </div>
            <span
              className="glass-pill"
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#fbbf24',
                padding: '1px 7px'
              }}
            >
              {currentMonthShort}
            </span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {headline.won_this_month}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>
              Won This Month
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
              Closed in {currentMonthLong} {currentYear}
            </div>
          </div>
        </div>

        {/* Card 4: Lost This Month */}
        <div
          className="glass-stat-card"
          style={{
            '--accent-glow': 'rgba(239, 68, 68, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="glass-icon-container" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.04) 100%)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
              <XCircle size={18} style={{ color: '#f87171' }} />
            </div>
            <span
              className="glass-pill"
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#f87171',
                padding: '1px 7px'
              }}
            >
              {currentMonthShort}
            </span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, color: headline.lost_this_month > 0 ? '#f87171' : '#64748b', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {headline.lost_this_month}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>
              Lost This Month
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
              Closed in {currentMonthLong} {currentYear}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Breakdowns Grid: Open Deals by Stage & by Owner */}
      <div className="grid-2" style={{ gap: '16px' }}>
        {/* Open Deals by Stage Card */}
        <div className="glass-card-exponential" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} style={{ color: '#818cf8' }} />
                <h2 style={{ fontSize: '0.975rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  Open Deals by Stage
                </h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', margin: 0 }}>
                Stage distribution with fixed win probability weighting
              </p>
            </div>

            <span className="glass-pill" style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {headline.open_deals} active deals
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {by_stage.map((s) => {
              const percentage = Math.round((s.count / (headline.open_deals || 1)) * 100);
              const barWidth = Math.round((s.count / maxStageCount) * 100);
              const theme = getStageTheme(s.stage);

              return (
                <div key={s.stage} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: theme.color,
                          boxShadow: `0 0 8px ${theme.glow}`
                        }}
                      />
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{s.label}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: theme.bg,
                          color: theme.color,
                          border: `1px solid ${theme.glow}`
                        }}
                      >
                        {theme.prob}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.825rem' }}>
                        {s.count} {s.count === 1 ? 'deal' : 'deals'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '32px', textAlign: 'right', fontWeight: 500 }}>
                        {percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Luminous Glass Track Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '999px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: theme.gradient,
                        borderRadius: '999px',
                        boxShadow: `0 0 8px ${theme.glow}`,
                        transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
                    <span>Pipeline: <strong style={{ color: '#e2e8f0' }}>{formatINR(s.total_value, true)}</strong></span>
                    <span>Weighted Yield: <strong style={{ color: theme.color }}>{formatINR(s.weighted_value, true)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Open Deals by Owner Card (Clean without rank badges) */}
        <div className="glass-card-exponential" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: '#38bdf8' }} />
                <h2 style={{ fontSize: '0.975rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  Open Deals by Owner
                </h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', margin: 0 }}>
                Active open workload distribution across sales representatives
              </p>
            </div>

            <span className="glass-pill" style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {by_owner.length} Reps
            </span>
          </div>

          {by_owner.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <Users size={28} className="empty-state-icon text-muted" />
              <p className="empty-state-text" style={{ fontSize: '0.775rem' }}>No open opportunities found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {by_owner.map((owner) => {
                const percentage = Math.round((owner.count / (headline.open_deals || 1)) * 100);
                const barWidth = Math.round((owner.count / maxOwnerCount) * 100);

                return (
                  <div key={owner.owner_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Clean Avatar Circle */}
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.1) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.675rem',
                            fontWeight: 600,
                            color: '#a5b4fc'
                          }}
                        >
                          {owner.full_name.charAt(0)}
                        </div>

                        <span style={{ fontWeight: 500, color: '#f8fafc' }}>{owner.full_name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.825rem' }}>
                          {owner.count} {owner.count === 1 ? 'deal' : 'deals'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '32px', textAlign: 'right', fontWeight: 500 }}>
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '999px',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #6366f1, #38bdf8)',
                          borderRadius: '999px',
                          boxShadow: '0 0 6px rgba(99, 102, 241, 0.25)',
                          transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
                      <span>Pipeline: <strong style={{ color: '#e2e8f0' }}>{formatINR(owner.total_value, true)}</strong></span>
                      <span>Weighted: <strong style={{ color: '#818cf8' }}>{formatINR(owner.weighted_value, true)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Deals Won (Last 8 Weeks Chart - Compact) */}
      <div className="glass-card-exponential" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: '#34d399' }} />
              <h2 style={{ fontSize: '0.975rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                Deals Won &mdash; Last 8 Weeks
              </h2>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', margin: 0 }}>
              Closed won opportunities per calendar week (zero-win weeks preserved)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              className="glass-pill"
              style={{
                fontSize: '0.725rem',
                color: '#34d399',
                borderColor: 'rgba(52, 211, 153, 0.25)'
              }}
            >
              <CheckCircle2 size={12} style={{ color: '#34d399' }} />
              Total 8W Wins: <strong style={{ color: '#ffffff', marginLeft: '2px' }}>{total8WeekWins} deals</strong>
            </span>

            <span
              className="glass-pill"
              style={{
                fontSize: '0.725rem',
                color: '#e2e8f0'
              }}
            >
              Closed Revenue: <strong style={{ color: '#38bdf8', marginLeft: '2px' }}>{formatINR(total8WeekValue, true)}</strong>
            </span>
          </div>
        </div>

        {/* Recharts Bar with Soft Gradients */}
        <div style={{ width: '100%', height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={wins_by_week}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <defs>
                <linearGradient id="exponentialEmeraldBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="exponentialZeroBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity={0.1} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              />
              <YAxis
                allowDecimals={false}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              />
              <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
              
              <Bar
                dataKey="count"
                radius={[5, 5, 0, 0]}
                maxBarSize={38}
              >
                {wins_by_week.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.count > 0 ? "url(#exponentialEmeraldBar)" : "url(#exponentialZeroBar)"}
                    stroke={entry.count > 0 ? "rgba(52, 211, 153, 0.7)" : "transparent"}
                    strokeWidth={entry.count > 0 ? 1 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          fontSize: '0.725rem',
          color: '#94a3b8',
          marginTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '2px', display: 'inline-block', boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)' }} />
            <span>Weeks with Deals Won</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#334155', borderRadius: '2px', display: 'inline-block' }} />
            <span>Zero-win Weeks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
