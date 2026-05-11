import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      const config = error.config as RetryConfig | undefined;
      if (refreshToken && config && !config._retry) {
        config._retry = true;
        try {
          const { data } = await axios.post('/api/auth/refresh/', {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', data.access);
          config.headers.Authorization = `Bearer ${data.access}`;
          return apiClient(config);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
