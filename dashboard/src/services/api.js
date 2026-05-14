import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/v1/auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_role');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/signin', { email, password });
    if (response.data.success) {
      localStorage.setItem('auth_token', response.data.accessToken);
      // We'll decode the role in the component or here
    }
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    window.location.href = '/login';
  },
  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },
};

export const adminService = {
  getAllUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },
  getUserById: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },
  updateUser: async (userId, data) => {
    const response = await api.put(`/admin/users/${userId}`, data);
    return response.data;
  },
  deleteUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },
  broadcastEmail: async (subject, message) => {
    const response = await api.post('/broadcast-email', { subject, message });
    return response.data;
  },
  // OAuth Client Management
  registerOAuthClient: async (data) => {
    const response = await api.post('/admin/oauth-clients', data);
    return response.data;
  },
  listOAuthClients: async () => {
    const response = await api.get('/admin/oauth-clients');
    return response.data;
  },
  deleteOAuthClient: async (clientId) => {
    const response = await api.delete(`/admin/oauth-clients/${clientId}`);
    return response.data;
  },
};

export default api;
