import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, username: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on mount
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  };

  const register = async (email: string, username: string, password: string) => {
    await api.register(email, username, password);
    // User is not set here because verification is required
  };

  const verifyEmail = async (email: string, code: string) => {
    const u = await api.verifyEmail(email, code);
    setUser(u);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      import('../theme/ThemeProvider').then(m => m.clearThemeOnLogout()).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyEmail, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
