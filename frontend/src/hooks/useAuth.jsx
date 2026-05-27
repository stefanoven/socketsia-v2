/**
 * Authentication hook.
 * Fetches current user from /api/auth/me.
 * The JWT is in an httpOnly cookie managed by the backend — no token storage needed.
 */
import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {}
    queryClient.clear();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
