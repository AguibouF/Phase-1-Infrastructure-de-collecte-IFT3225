import type { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ApiError, meta } from '../utils/responses';

// 404 pour toute route non déclarée.
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    error: { code: 'NOT_FOUND', message: 'Endpoint inexistant.' },
    meta: meta(),
  });
}

interface MongoDuplicateError {
  code?: number;
  keyValue?: Record<string, unknown>;
}

// Gestionnaire central : convertit toute erreur en enveloppe d'erreur standard.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): Response {
  // Erreurs de validation Mongoose -> 400 VALIDATION_ERROR
  if (err instanceof MongooseError.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, issue: e.kind }));
    return res.status(400).json({
      status: 'error',
      error: { code: 'VALIDATION_ERROR', message: 'Données invalides.', details },
      meta: meta(),
    });
  }
  // Violation d'unicité Mongo -> 409
  if (typeof err === 'object' && err !== null && (err as MongoDuplicateError).code === 11000) {
    const keyValue = (err as MongoDuplicateError).keyValue || {};
    return res.status(409).json({
      status: 'error',
      error: { code: 'CONFLICT', message: 'Ressource déjà existante.', details: [{ field: Object.keys(keyValue)[0], issue: 'duplicate' }] },
      meta: meta(),
    });
  }
  // CastError (ObjectId invalide) -> 404
  if (err instanceof MongooseError.CastError) {
    return res.status(404).json({
      status: 'error',
      error: { code: 'NOT_FOUND', message: 'Identifiant invalide ou ressource introuvable.' },
      meta: meta(),
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.httpStatus).json({
      status: 'error',
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      meta: meta(),
    });
  }
  // Erreur inattendue -> 500
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({
    status: 'error',
    error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur non prévue.' },
    meta: meta(),
  });
}
