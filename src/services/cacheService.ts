import NodeCache from 'node-cache';

// Configuration du cache en mémoire
const cache = new NodeCache({
  stdTTL: 3600, // TTL par défaut : 1 heure
  checkperiod: 600, // Vérification des entrées expirées toutes les 10 minutes
  useClones: false, // Performance : pas de clonage profond
});

export const cacheService = {
  // Récupérer une valeur du cache
  get: (key: string): unknown | undefined => {
    return cache.get(key);
  },

  // Définir une valeur dans le cache avec TTL personnalisé
  set: (key: string, value: unknown, ttl?: number): boolean => {
    return ttl !== undefined ? cache.set(key, value, ttl) : cache.set(key, value);
  },

  // Supprimer une entrée du cache
  del: (key: string): number => {
    return cache.del(key);
  },

  // Supprimer toutes les entrées correspondant à un pattern
  delPattern: (pattern: string): void => {
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.includes(pattern));
    if (keysToDelete.length > 0) {
      cache.del(keysToDelete);
    }
  },

  // Vider tout le cache
  flushAll: (): void => {
    cache.flushAll();
  },

  // Obtenir des statistiques du cache
  getStats: () => {
    return cache.getStats();
  },
};

export default cacheService;
