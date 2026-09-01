import client from './client';

export const dealsAPI = {
  // Get deals visible to current user (supports server-side search, filtering, sorting, and pagination)
  getDeals: (params = {}) => {
    return client.get('/deals', { params });
  },

  // Get deals where user is owner or collaborator (Spec §5 My Deals)
  getMyDeals: () => {
    return client.get('/deals/my-deals');
  },

  // Get single deal by ID
  getDeal: (id) => {
    return client.get(`/deals/${id}`);
  },

  // Create a new deal
  createDeal: (data) => {
    return client.post('/deals', data);
  },

  // Update a deal (title, value, date, or manager owner reassignment)
  updateDeal: (id, data) => {
    return client.put(`/deals/${id}`, data);
  },

  // Soft-delete a deal
  deleteDeal: (id) => {
    return client.delete(`/deals/${id}`);
  },

  // Collaborators
  getCollaborators: (dealId) => {
    return client.get(`/deals/${dealId}/collaborators`);
  },

  addCollaborator: (dealId, userId) => {
    return client.post(`/deals/${dealId}/collaborators`, { user_id: userId });
  },

  removeCollaborator: (dealId, userId) => {
    return client.delete(`/deals/${dealId}/collaborators/${userId}`);
  },

  // Deal Audit Trail Timeline
  getHistory: (dealId) => {
    return client.get(`/deals/${dealId}/history`);
  },

  // Lifecycle Stage Transitions
  changeStage: (dealId, stage, reason) => {
    return client.post(`/deals/${dealId}/stage`, { stage, reason });
  },

  // Manager-only Deal Reopening
  reopenDeal: (dealId) => {
    return client.post(`/deals/${dealId}/reopen`);
  },

  // Immutable Notes (append-only, §9)
  addNote: (dealId, note) => {
    return client.post(`/deals/${dealId}/notes`, { note });
  }
};
