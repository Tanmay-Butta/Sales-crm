/**
 * Auth API functions.
 */

import client from './client';

export const authAPI = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  register: (data) =>
    client.post('/auth/register', data),

  getMe: () =>
    client.get('/auth/me'),

  getReps: () =>
    client.get('/auth/users/reps'),

  getUsers: () =>
    client.get('/auth/users'),
};
