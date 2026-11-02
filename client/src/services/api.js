import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('otion_token') || localStorage.getItem('otion_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('otion_token');
      localStorage.removeItem('otion_token');
      window.dispatchEvent(new Event('otion:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export default api;
