import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';

// Contexte d'authentification : partage l'identité de l'utilisateur (user, token)
// et les actions login/logout dans toute l'application, sans faire transiter ces
// valeurs de composant en composant. Gère aussi la persistance dans le
// localStorage et la déconnexion automatique quand le serveur rejette le token.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Restaure la session depuis le localStorage au démarrage.
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    useUIStore.getState().resetNavigation();
  }, []);

  // Déconnexion automatique quand l'API signale un token expiré/invalide
  // (événement émis par l'intercepteur axios dans ambianceApi).
  useEffect(() => {
    const onExpired = () => {
      logout();
      useUIStore.getState().setNotice('Votre session a expiré. Veuillez vous reconnecter.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  const value = { user, token, isAuthenticated: !!user && !!token, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook d'accès au contexte d'authentification.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  return ctx;
}
