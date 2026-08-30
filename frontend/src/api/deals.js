/**
 * API service for Deals, Collaborators, and History.
 */

import client from './client';

export const dealsAPI = {
  // Get all deals visible to the user globally
  getDeals: () => client.get('/deals'),

  // Get deals where user is owner or collaborator (Spec §5)
  getMyDeals: () => client.get('/deals/my-deals'),

  // Get a specific deal
  getDeal: (id) => client.get(`/deals/${id}`),

  // Create a new deal
  createDeal: (data) => client.post('/deals', data),

  // Update a deal's basic info (title, value, date, or owner for manager)
  updateDeal: (id, data) => client.put(`/deals/${id}`, data),

  // Delete a deal
  deleteDeal: (id) => client.delete(`/deals/${id}`),

  // Collaborators
  getCollaborators: (dealId) => client.get(`/deals/${dealId}/collaborators`),
  addCollaborator: (dealId, userId) => client.post(`/deals/${dealId}/collaborators`, { user_id: userId }),
  removeCollaborator: (dealId, userId) => client.delete(`/deals/${dealId}/collaborators/${userId}`),

  // History / Audit trail
  getHistory: (dealId) => client.get(`/deals/${dealId}/history`),
};
