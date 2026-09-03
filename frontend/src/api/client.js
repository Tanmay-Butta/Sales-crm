/**
 * Axios HTTP client with secure JWT handling, sanitized logging,
 * and precise cycle timing (network latency + React render duration).
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const IS_DEV = import.meta.env.DEV;

const client = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token securely & record start timestamp
client.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: performance.now() };

    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (IS_DEV) {
      const method = config.method?.toUpperCase();
      console.log(
        `%c🚀 [API Request] ${method} ${config.url}`,
        'color: #38bdf8; font-weight: 500;'
      );
    }

    return config;
  },
  (error) => {
    if (IS_DEV) {
      console.error('[API Request Error]', error.message);
    }
    return Promise.reject(error);
  }
);

// Response interceptor: compute network latency and total render cycle time
client.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      const method = response.config.method?.toUpperCase();
      const status = response.status;
      const url = response.config.url;
      const startTime = response.config.metadata?.startTime || performance.now();
      const netDurationMs = Math.round(performance.now() - startTime);

      console.log(
        `%c✅ [API Response ${status}] ${method} ${url} (${netDurationMs}ms network)`,
        'color: #34d399; font-weight: 500;'
      );

      // Measure total roundtrip including React DOM reconciliation and paint
      requestAnimationFrame(() => {
        setTimeout(() => {
          const totalCycleMs = Math.round(performance.now() - startTime);
          console.log(
            `%c⏱️ [Cycle Complete] ${method} ${url} → Network: ${netDurationMs}ms | Total (with render): ${totalCycleMs}ms`,
            'color: #c084fc; font-weight: bold; background: rgba(168, 85, 247, 0.12); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(168, 85, 247, 0.25);'
          );
        }, 0);
      });
    }
    return response;
  },
  (error) => {
    const status = error.response?.status || 'Network Error';
    const method = error.config?.method?.toUpperCase() || 'REQUEST';
    const url = error.config?.url || 'unknown';
    const startTime = error.config?.metadata?.startTime || performance.now();
    const durationMs = Math.round(performance.now() - startTime);

    console.error(
      `[API Error ${status}] ${method} ${url} (${durationMs}ms):`,
      error.response?.data?.error?.message || error.message
    );

    if (error.response?.status === 401) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
