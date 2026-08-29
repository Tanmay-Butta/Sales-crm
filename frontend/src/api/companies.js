import client from './client';

export const companiesAPI = {
  getCompanies: (showArchived = false) => {
    return client.get(`/companies?show_archived=${showArchived}`);
  },
  
  createCompany: (data) => {
    return client.post('/companies', data);
  },
  
  updateCompany: (id, data) => {
    return client.put(`/companies/${id}`, data);
  },
  
  archiveCompany: (id) => {
    return client.patch(`/companies/${id}/archive`);
  },
  
  restoreCompany: (id) => {
    return client.patch(`/companies/${id}/restore`);
  }
};
