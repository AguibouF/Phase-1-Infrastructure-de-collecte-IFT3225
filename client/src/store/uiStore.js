import { create } from 'zustand';

// Store d'interface (Zustand) : centralise l'état de navigation et la bannière
// de notification, qui sont partagés par toute l'application et gagnent à vivre
// hors des composants (accessibles même depuis du code non-React, ex. le
// gestionnaire d'événement « session expirée »).
//
// Vues mutuellement exclusives : 'map' | 'where-to-go' | 'my-locations'.
// L'ouverture d'un lieu (`selectedLocation`) se superpose à la vue courante.
export const useUIStore = create((set) => ({
  view: 'map',
  selectedLocation: null,
  showFavoritesOnly: false,
  authView: null, // null | 'login' | 'register'
  notice: '',

  // Navigation principale : bascule de vue en réinitialisant le lieu ouvert.
  setView: (view) => set({ view, selectedLocation: null }),

  // Ouvre/ferme le détail d'un lieu.
  selectLocation: (location) => set({ selectedLocation: location }),
  clearLocation: () => set({ selectedLocation: null }),

  toggleFavoritesOnly: () =>
    set((s) => ({ showFavoritesOnly: !s.showFavoritesOnly, view: 'map', selectedLocation: null })),

  // Formulaires d'authentification.
  openAuth: (authView) => set({ authView }),
  closeAuth: () => set({ authView: null }),

  // Bannière d'information (session expirée, erreur favoris…).
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: '' }),

  // Remise à zéro de la navigation à la déconnexion.
  resetNavigation: () =>
    set({ view: 'map', selectedLocation: null, showFavoritesOnly: false, authView: null }),
}));
