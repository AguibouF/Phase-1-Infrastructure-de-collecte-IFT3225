import type { Response } from 'express';

// Détail d'erreur associé à un champ précis (table des erreurs du rapport).
export interface ErrorDetail {
  field?: string;
  issue?: string;
  index?: number;
  code?: string;
  [key: string]: unknown;
}

export interface Meta {
  generatedAt: string;
  [key: string]: unknown;
}

// Helpers pour l'enveloppe standard { status, data, meta }.
export function meta(extra: Record<string, unknown> = {}): Meta {
  return { generatedAt: new Date().toISOString(), ...extra };
}

export function success(res: Response, status: number, data: unknown, metaExtra: Record<string, unknown> = {}): Response {
  return res.status(status).json({ status: 'success', data, meta: meta(metaExtra) });
}

// Erreur applicative transportée jusqu'au errorHandler central.
export class ApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[]
  ) {
    super(message);
  }
}

// Raccourcis vers les codes machine définis dans le rapport (table des erreurs).
export const errors = {
  validation: (message: string, details?: ErrorDetail[]) => new ApiError(400, 'VALIDATION_ERROR', message, details),
  missingAuth: (message = 'Authentification absente.') => new ApiError(401, 'MISSING_AUTH', message),
  unauthorized: (code: string, message: string) => new ApiError(401, code, message),
  forbidden: (message = 'Clé invalide ou accès refusé.') => new ApiError(403, 'FORBIDDEN', message),
  locationNotFound: (message = 'Lieu inexistant ou slug incorrect.') => new ApiError(404, 'LOCATION_NOT_FOUND', message),
  notFound: (message = 'Ressource introuvable.') => new ApiError(404, 'NOT_FOUND', message),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  invalidValue: (message: string, details?: ErrorDetail[]) => new ApiError(422, 'INVALID_VALUE', message, details),
  rateLimit: (message = 'Trop de requêtes.') => new ApiError(429, 'RATE_LIMIT', message),
};
