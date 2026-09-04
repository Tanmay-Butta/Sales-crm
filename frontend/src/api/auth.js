/**
 * Auth API functions.
 */

import client from './client';

export const authAPI = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  createUser: (data) =>
    client.post('/auth/users', data),

  getMe: () =>
    client.get('/auth/me'),

  getReps: () =>
    client.get('/auth/users/reps'),

  getUsers: () =>
    client.get('/auth/users'),
};
