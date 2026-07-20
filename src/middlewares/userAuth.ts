import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET || 'votre-secret-jet-a-changer-en-production';

interface JwtUserPayload {
  userId: string;
  username: string;
}

// Authentification utilisateur (Phase 2) : vérifie le JWT dans Authorization: Bearer <token>.
export function userAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        error: { code: 'NO_TOKEN', message: "Token d'authentification manquant" },
      });
      return;
    }

    const token = authHeader.substring(7); // Retire le préfixe 'Bearer '

    const decoded = jwt.verify(token, JWT_SECRET) as JwtUserPayload;

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };

    next();
  } catch {
    res.status(401).json({
      status: 'error',
      error: { code: 'INVALID_TOKEN', message: "Token d'authentification invalide ou expiré" },
    });
  }
}
