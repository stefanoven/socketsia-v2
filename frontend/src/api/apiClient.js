/**
 * Axios API client.
 * Sends credentials (httpOnly cookie) with every request.
 * Redirects to /login on 401.
 */
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send httpOnly cookie automatically
  headers: { 'Content-Type': 'application/json' },
});

// Intercept 401 responses and redirect to login
// IMPORTANT: skip redirect if already on /login to avoid infinite refresh loop
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !window.location.pathname.startsWith('/login')
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default apiClient;
