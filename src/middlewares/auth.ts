import type { Request, Response, NextFunction } from 'express';
import Device from '../models/Device';
import { errors } from '../utils/responses';

// Authentification des endpoints d'ÉCRITURE (collecte).
// Conforme à la Tâche 5 : clé transmise dans l'en-tête x-api-key.
//   401 MISSING_AUTH  -> en-tête absent
//   403 FORBIDDEN     -> clé qui ne correspond à aucun device
//   (sinon) requête autorisée, req.device renseigné
export async function deviceAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.get('x-api-key');
    if (!key) throw errors.missingAuth('En-tête x-api-key absent.');
    const device = await Device.findOne({ apiKey: key });
    if (!device) throw errors.forbidden('Clé API invalide.');
    req.device = device;
    device.lastSeenAt = new Date();
    await device.save();
    next();
  } catch (err) {
    next(err);
  }
}

// Authentification des endpoints de GESTION (clé d'administration).
// Utilisée pour DELETE /devices et la gestion des lieux.
export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const key = req.get('x-api-key');
    if (!key) throw errors.missingAuth('En-tête x-api-key absent.');
    if (key !== process.env.ADMIN_API_KEY) throw errors.forbidden("Clé d'administration invalide.");
    next();
  } catch (err) {
    next(err);
  }
}
