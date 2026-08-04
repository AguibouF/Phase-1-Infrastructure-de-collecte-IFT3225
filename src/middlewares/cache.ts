import { Request, Response, NextFunction } from 'express';
import cacheService from '../services/cacheService';

/**
 * Middleware de cache pour les lectures publiques (GET).
 *
 * Il agit à deux niveaux :
 *  1. **HTTP** : pose l'en-tête `Cache-Control: public, max-age=<maxAge>` pour
 *     autoriser navigateurs et proxys à réutiliser la réponse.
 *  2. **Mémoire serveur** : met en cache le corps de la réponse (clé =
 *     `req.originalUrl`) pendant `maxAge` secondes, évitant de refaire les
 *     agrégations MongoDB à chaque appel. L'en-tête `X-Cache: HIT|MISS` indique
 *     l'origine de la réponse.
 *
 * Invalidation : les routes d'écriture appellent `cacheService.delPattern(...)`
 * avec le segment concerné (`ambiance`, `measurements`, …) ; comme la clé est
 * l'URL (qui contient ce segment), les entrées correspondantes sont purgées.
 *
 * N'est appliqué qu'aux routes de lecture publiques. Les données par utilisateur
 * ou sensibles utilisent `noCache` (voir ci-dessous) et ne sont jamais mises en
 * cache.
 */
export function cacheControl(maxAge: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);

    // Le cache mémoire ne s'applique qu'aux GET (les écritures passent par noCache).
    if (req.method !== 'GET') return next();

    const key = req.originalUrl;
    const cached = cacheService.get(key);
    if (cached !== undefined) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // Cache manquant : on intercepte res.json pour stocker le corps une fois calculé.
    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // On ne met en cache que les réponses réussies (pas les erreurs).
      if (res.statusCode === 200) cacheService.set(key, body, maxAge);
      return originalJson(body);
    };
    next();
  };
}

// Middleware pour désactiver le cache (données sensibles, par utilisateur, temps réel)
export function noCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
