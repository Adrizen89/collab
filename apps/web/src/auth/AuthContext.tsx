import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginRequest, PublicUser } from '@collab/shared';
import {
  api,
  bootstrapSession,
  login as apiLogin,
  logout as apiLogout,
  setAccessToken,
  setOnAuthFailure,
} from '../lib/api';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  /** Renvoie '2fa' si un code de double authentification est requis. */
  login: (body: LoginRequest) => Promise<'ok' | '2fa'>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restauration de session au démarrage (via le cookie refresh httpOnly).
  useEffect(() => {
    let mounted = true;
    bootstrapSession()
      .then((u) => {
        if (mounted) setUser(u);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Si un appel échoue définitivement en 401, on déconnecte proprement.
  useEffect(() => {
    setOnAuthFailure(() => {
      setAccessToken(null);
      setUser(null);
    });
    return () => setOnAuthFailure(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (body) => {
        const res = await apiLogin(body);
        if ('twoFactorRequired' in res) {
          return '2fa';
        }
        setAccessToken(res.accessToken);
        setUser(res.user);
        return 'ok';
      },
      logout: async () => {
        await apiLogout();
        setUser(null);
      },
      refreshUser: async () => {
        setUser(await api.me());
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return ctx;
}
