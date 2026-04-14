import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { apiGet, apiPost } from '../utils/api';

interface User {
  id: number;
  username: string;
  email: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
}

// Keys that hold user-specific data — cleared on logout to prevent cross-user leakage
const USER_SPECIFIC_STORAGE_KEYS = [
  'weatherZipCode',
  'homestead-active-plan-id',
  'checkedBedIds',
  'homestead_plants_cache',
  'homestead_available_crops_cache',
  'homestead_seed_catalog_cache',
];

// Keys whose values are saved per-user so they survive logout/login cycles
const PER_USER_PERSISTED_KEYS = ['weatherZipCode'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await apiGet('/api/auth/check');

      if (response.ok) {
        const data = await response.json();
        // Restore per-user persisted values on session resume (same as login)
        const userId = data.user.id;
        PER_USER_PERSISTED_KEYS.forEach(key => {
          const saved = localStorage.getItem(`${key}__user_${userId}`);
          if (saved) {
            localStorage.setItem(key, saved);
          }
        });
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiPost('/api/auth/login', { username, password });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Restore per-user persisted values (e.g. zip code) before setting user
    const userId = data.user.id;
    PER_USER_PERSISTED_KEYS.forEach(key => {
      const saved = localStorage.getItem(`${key}__user_${userId}`);
      if (saved) {
        localStorage.setItem(key, saved);
      }
    });

    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    // Save per-user values before clearing
    setUser(prev => {
      if (prev) {
        PER_USER_PERSISTED_KEYS.forEach(key => {
          const val = localStorage.getItem(key);
          if (val) {
            localStorage.setItem(`${key}__user_${prev.id}`, val);
          }
        });
      }
      return prev;
    });

    const response = await apiPost('/api/auth/logout');

    if (response.ok) {
      setUser(null);
      USER_SPECIFIC_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const response = await apiPost('/api/auth/register', { username, email, password });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setUser(data.user);
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    register,
  }), [user, loading, login, logout, register]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
