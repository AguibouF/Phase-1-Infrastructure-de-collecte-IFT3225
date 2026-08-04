// Configuration du cache frontend
const CACHE_PREFIX = 'ambiance_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes par défaut

// Générer une clé de cache basée sur l'URL et les paramètres
export function generateCacheKey(url, params = {}) {
  const paramString = new URLSearchParams(params).toString();
  return `${CACHE_PREFIX}${url}${paramString ? `_${paramString}` : ''}`;
}

// Vérifier si une entrée du cache est encore valide
export function isCacheValid(cachedData) {
  if (!cachedData || !cachedData.timestamp) return false;
  const ttl = cachedData.ttl || DEFAULT_TTL;
  return Date.now() - cachedData.timestamp < ttl;
}

// Récupérer une valeur du cache
export function getFromCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!isCacheValid(parsed)) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error('Erreur lecture cache:', e);
    return null;
  }
}

// Définir une valeur dans le cache
export function setCache(key, data, ttl = DEFAULT_TTL) {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (e) {
    console.error('Erreur écriture cache:', e);
  }
}

// Supprimer une entrée du cache
export function deleteCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Erreur suppression cache:', e);
  }
}

// Supprimer toutes les entrées du cache correspondant à un pattern
export function deleteCachePattern(pattern) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('Erreur suppression pattern cache:', e);
  }
}

// Vider tout le cache de l'application
export function clearAppCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('Erreur vidage cache:', e);
  }
}
