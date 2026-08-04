import { Request, Response, NextFunction } from 'express';

// Middleware pour ajouter les headers Cache-Control
export function cacheControl(maxAge: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    next();
  };
}

// Middleware pour désactiver le cache (données sensibles, temps réel)
export function noCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
