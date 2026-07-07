import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/v1';

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
};
