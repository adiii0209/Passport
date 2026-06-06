import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const adminApi = axios.create({
  baseURL: `${API_BASE}/admin`,
  timeout: 60000,
  headers: {
    Accept: 'application/json',
  },
});

// Request interceptor: attach token
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (window.location.pathname !== '/admin') {
        window.location.href = '/admin';
      }
    }
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const login = async (username, password) => {
  const response = await adminApi.post('/login', { username, password });
  if (response.data.success) {
    localStorage.setItem('admin_token', response.data.token);
    localStorage.setItem('admin_user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/admin';
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('admin_token');
};

export const getStats = async () => {
  const response = await adminApi.get('/stats');
  return response.data;
};

export const getPortals = async () => {
  const response = await adminApi.get('/portals');
  return response.data;
};

export const getPortalById = async (id) => {
  const response = await adminApi.get(`/portals/${id}`);
  return response.data;
};

export const createPortal = async (data) => {
  const response = await adminApi.post('/portals', data);
  return response.data;
};

export const updatePortal = async (id, data) => {
  const response = await adminApi.put(`/portals/${id}`, data);
  return response.data;
};

export const deletePortal = async (id) => {
  const response = await adminApi.delete(`/portals/${id}`);
  return response.data;
};

export const togglePortal = async (id) => {
  const response = await adminApi.patch(`/portals/${id}/toggle`);
  return response.data;
};

export const uploadMedia = async (file, mediaType, portalId) => {
  const formData = new FormData();
  formData.append('media', file);
  formData.append('mediaType', mediaType);
  if (portalId) {
    formData.append('portalId', portalId);
  }

  const response = await adminApi.post('/upload-media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export default adminApi;
