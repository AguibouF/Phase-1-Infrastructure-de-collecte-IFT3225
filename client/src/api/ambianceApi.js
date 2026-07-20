import axios from 'axios';

// URL de l'API configurable via client/.env (VITE_API_URL) — voir .env.example
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1';

// Si le serveur rejette le token (401 sur une action protégée), on prévient
// l'application pour qu'elle déconnecte l'utilisateur au lieu d'échouer en silence.
// Les 401 de /auth/login et /auth/register sont exclus : ce sont de simples
// identifiants invalides, pas une session expirée.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthAttempt) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  }
);

export const ambianceApi = {
  // Récupérer tous les lieux
  getLocations: async () => {
    const response = await axios.get(`${API_BASE_URL}/locations`);
    return response.data;
  },

  // Récupérer l'ambiance actuelle d'un lieu
  getCurrentAmbiance: async (slug, window = '30m') => {
    const response = await axios.get(`${API_BASE_URL}/ambiance/${slug}/now?window=${window}`);
    return response.data;
  },

  // Récupérer l'historique d'un lieu
  getHistory: async (slug, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await axios.get(`${API_BASE_URL}/ambiance/${slug}/history?${queryParams}`);
    return response.data;
  },

  // Récupérer les créneaux calmes
  getQuietHours: async (slug, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await axios.get(`${API_BASE_URL}/ambiance/${slug}/quiet-hours?${queryParams}`);
    return response.data;
  },

  // Inscription
  register: async (username, email, password) => {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, { username, email, password });
    return response.data;
  },

  // Connexion
  login: async (username, password) => {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
    return response.data;
  },

  // Soumettre une observation (authentifié)
  submitObservation: async (token, observationData) => {
    const response = await axios.post(`${API_BASE_URL}/observations/user`, observationData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Ajouter un lieu aux favoris
  addFavorite: async (token, locationSlug) => {
    const response = await axios.post(`${API_BASE_URL}/auth/favorites`, { locationSlug }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Retirer un lieu des favoris
  removeFavorite: async (token, locationSlug) => {
    const response = await axios.delete(`${API_BASE_URL}/auth/favorites/${locationSlug}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Récupérer les lieux favoris
  getFavorites: async (token) => {
    const response = await axios.get(`${API_BASE_URL}/auth/favorites`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Récupérer les lieux où l'utilisateur a effectué des écoutes
  getMyLocations: async (token) => {
    const response = await axios.get(`${API_BASE_URL}/auth/my-locations`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Temps réel (SSE, bonus) : s'abonner aux nouvelles mesures/observations.
  // onEvent reçoit { kind, locationSlug, at } ; locationSlug (optionnel) filtre côté serveur.
  // L'appelant doit fermer le flux avec .close() au démontage du composant.
  subscribeToAmbianceEvents: (onEvent, locationSlug) => {
    const url = locationSlug
      ? `${API_BASE_URL}/events?locationSlug=${encodeURIComponent(locationSlug)}`
      : `${API_BASE_URL}/events`;
    const source = new EventSource(url);
    const handler = (e) => {
      try { onEvent(JSON.parse(e.data)); } catch { /* événement malformé : ignoré */ }
    };
    source.addEventListener('measurement', handler);
    source.addEventListener('observation', handler);
    return source;
  },
};
