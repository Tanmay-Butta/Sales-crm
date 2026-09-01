import client from './client';

export const dashboardAPI = {
  // Get aggregated dashboard data (headline metrics, stage/owner breakdown, 8-week won deals)
  getDashboard: () => {
    return client.get('/dashboard');
  }
};
