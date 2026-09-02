/**
 * Alerts API client (Goal 10).
 */

import client from './client';

export const alertsAPI = {
  getAlerts: () => client.get('/alerts'),
  getAlertsCount: () => client.get('/alerts/count'),
  dismissAlert: (dealId) => client.post(`/alerts/${dealId}/dismiss`),
};
