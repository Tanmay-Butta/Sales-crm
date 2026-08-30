/**
 * API service for Deals.
 */

import client from './client';

export const dealsAPI = {
  // Get all deals the user is authorized to see
  getDeals: () => client.get('/deals'),

  // Get a specific deal
  getDeal: (id) => client.get(`/deals/${id}`),

  // Create a new deal
  createDeal: (data) => client.post('/deals', data),

  // Update a deal's basic info (title, value, date)
  updateDeal: (id, data) => client.put(`/deals/${id}`, data),

  // Delete a deal
  deleteDeal: (id) => client.delete(`/deals/${id}`),
};
