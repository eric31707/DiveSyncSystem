import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://localhost:7001/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // 跨域帶 Cookie（如有需要啟用）
  // withCredentials: true,
});

// ── Request Interceptor ──
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor ──
axiosClient.interceptors.response.use(
  (response) => response.data, // 直接拆包 data
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // TODO: refresh token or redirect to login
      console.warn('[axiosClient] 401 Unauthorized');
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
