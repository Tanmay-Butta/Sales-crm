/**
 * ShimmerLoader — Modern Zomato / Linear-style skeleton loader.
 * Features:
 * 1. Rotating status messages to keep users engaged during cloud latency / cold starts.
 * 2. Realistic glassmorphism shimmer skeletons for tables, dashboard cards, and alert rows.
 */

import { useState, useEffect } from 'react';

const DEFAULT_MESSAGES = [
  'Connecting to secure cloud server...',
  'Fetching latest deals & pipeline data...',
  'Checking permissions & company associations...',
  'Almost ready! Rendering your workspace...'
];

export default function ShimmerLoader({
  messages = DEFAULT_MESSAGES,
  type = 'table', // 'table' | 'cards' | 'alerts' | 'detail'
  rows = 5
}) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 1200);

    return () => clearInterval(timer);
  }, [messages]);

  return (
    <div style={{ padding: '24px 20px', width: '100%' }}>
      {/* Dynamic Rotating Status Header (Zomato-style) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div className="shimmer-status-pill">
          <span className="pulsing-dot" />
          <span>Status:</span>
          <span className="shimmer-status-text">
            {messages[currentMessageIndex]}
          </span>
        </div>
      </div>

      {/* Skeletons based on type */}
      {type === 'table' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          {/* Header row skeleton */}
          <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="shimmer" style={{ width: '28%', height: '18px' }} />
            <div className="shimmer" style={{ width: '18%', height: '18px' }} />
            <div className="shimmer" style={{ width: '14%', height: '18px' }} />
            <div className="shimmer" style={{ width: '16%', height: '18px' }} />
            <div className="shimmer" style={{ width: '14%', height: '18px' }} />
          </div>

          {/* Body rows skeleton */}
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                background: 'rgba(30, 33, 50, 0.4)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
              }}
            >
              {/* Deal Title + Company */}
              <div style={{ width: '28%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="shimmer" style={{ width: '80%', height: '16px', borderRadius: '4px' }} />
                <div className="shimmer" style={{ width: '45%', height: '12px', borderRadius: '4px' }} />
              </div>

              {/* Stage Pill */}
              <div style={{ width: '18%' }}>
                <div className="shimmer" style={{ width: '90px', height: '26px', borderRadius: '9999px' }} />
              </div>

              {/* Value */}
              <div style={{ width: '14%' }}>
                <div className="shimmer" style={{ width: '70px', height: '18px', borderRadius: '4px' }} />
              </div>

              {/* Close Date */}
              <div style={{ width: '16%' }}>
                <div className="shimmer" style={{ width: '85px', height: '14px', borderRadius: '4px' }} />
              </div>

              {/* Owner / Action */}
              <div style={{ width: '14%', display: 'flex', justifyContent: 'flex-end' }}>
                <div className="shimmer" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {type === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top 4 KPI metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '20px',
                  background: 'rgba(30, 33, 50, 0.5)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="shimmer" style={{ width: '100px', height: '14px', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                </div>
                <div className="shimmer" style={{ width: '140px', height: '32px', borderRadius: '6px' }} />
                <div className="shimmer" style={{ width: '80px', height: '12px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>

          {/* Big Chart Skeleton */}
          <div
            style={{
              padding: '24px',
              background: 'rgba(30, 33, 50, 0.4)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              height: '280px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div className="shimmer" style={{ width: '220px', height: '20px', borderRadius: '4px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '200px', padding: '10px 0' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shimmer"
                  style={{
                    flex: 1,
                    height: `${30 + (i * 12) % 65}%`,
                    borderRadius: '6px 6px 0 0'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {type === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: '20px',
                background: 'rgba(30, 33, 50, 0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="shimmer" style={{ width: '180px', height: '20px', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ width: '85px', height: '22px', borderRadius: '9999px' }} />
                </div>
                <div className="shimmer" style={{ width: '90px', height: '18px', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="shimmer" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
                <div className="shimmer" style={{ width: '90px', height: '32px', borderRadius: '6px' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
