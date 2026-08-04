import NodeCache from 'node-cache';

/**
 * Service de cache en mémoire pour le backend.
 *
 * Stratégie de cache :
 * - Les données fréquemment accédées (locations, ambiance) sont mises en cache
 * - Le cache est invalidé automatiquement après chaque écriture (POST/PUT/DELETE)
 * - Les données sensibles (authentification) ne sont jamais mises en cache
 *
 * Note : Ce cache est perdu au redémarrage du serveur. Pour une production
 * avec scaling horizontal, utiliser Redis ou une solution distribuée.
 */
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
