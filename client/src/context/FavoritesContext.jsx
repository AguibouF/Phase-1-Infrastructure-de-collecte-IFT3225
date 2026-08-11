import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ambianceApi } from '../api/ambianceApi';
import { useAuth } from './AuthContext';
import { useUIStore } from '../store/uiStore';

// Contexte des favoris : partage la liste des lieux favoris et les opérations
// d'ajout/retrait entre la carte, le détail d'un lieu et « Mes lieux », sans
// prop-drilling. Dépend de l'authentification (les favoris sont propres à
// l'utilisateur connecté).
const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user, token } = useAuth();
  const [favorites, setFavorites] = useState([]);

  // Charge les favoris à la connexion ; les vide à la déconnexion.
  useEffect(() => {
    if (!user || !token) {
      setFavorites([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await ambianceApi.getFavorites(token);
        if (!cancelled) setFavorites(response.data.favoriteLocations || []);
      } catch (err) {
        console.error('Erreur chargement favoris:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user, token]);

  const isFavorite = useCallback((slug) => favorites.includes(slug), [favorites]);

  const toggleFavorite = useCallback(async (slug) => {
    if (!user || !token) return;
    try {
      if (favorites.includes(slug)) {
        // Confirmation avant retrait : action volontaire, évite les retraits accidentels.
        if (typeof window !== 'undefined' && !window.confirm('Retirer ce lieu de vos favoris ?')) return;
        await ambianceApi.removeFavorite(token, slug);
        setFavorites((prev) => prev.filter((s) => s !== slug));
      } else {
        await ambianceApi.addFavorite(token, slug);
        setFavorites((prev) => [...prev, slug]);
      }
      useUIStore.getState().clearNotice();
    } catch (err) {
      console.error('Erreur toggle favori:', err);
      // Le 401 est déjà géré globalement (déconnexion) ; on ne signale que le reste.
      if (err.response?.status !== 401) {
        useUIStore.getState().setNotice('Impossible de modifier le favori. Vérifiez votre connexion et réessayez.');
      }
    }
  }, [favorites, user, token]);

  const value = { favorites, isFavorite, toggleFavorite };
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

// Hook d'accès au contexte des favoris.
export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (ctx === null) throw new Error('useFavorites doit être utilisé dans un <FavoritesProvider>');
  return ctx;
}
