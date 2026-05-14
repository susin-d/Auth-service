import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1/auth';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('console_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('console_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authService = {
  login: async (email, password) => {
    const res = await api.post('/signin', { email, password });
    return res.data;
  },
  register: async (email, password) => {
    const res = await api.post('/signup', { email, password });
    return res.data;
  },
  getProfile: async () => {
    const res = await api.get('/profile');
    return res.data;
  },
};

export const developerService = {
  createApp: async (data) => {
    const res = await api.post('/developer/apps', data);
    return res.data;
  },
  listApps: async () => {
    const res = await api.get('/developer/apps');
    return res.data;
  },
  deleteApp: async (clientId) => {
    const res = await api.delete(`/developer/apps/${clientId}`);
    return res.data;
  },
};

export default api;
