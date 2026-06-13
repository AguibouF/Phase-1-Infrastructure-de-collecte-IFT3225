/**
 * Middleware d'authentification par clé API
 *
 * Vérifie l'en-tête HTTP `Authorization: Bearer <apiKey>`.
 * À appliquer sur toutes les routes POST de collecte :
 *   POST /v1/measurements
 *   POST /v1/observations
 *   POST /v1/measurements/batch
 *
 * Utilisation côté routes Express :
 *   import { requireApiKey } from "../middlewares/auth.js";
 *   router.post("/measurements", requireApiKey, measurementsController.create);
 *
 * Pré-requis : un modèle Mongoose `Device` (à coordonner avec la personne A)
 * qui expose au minimum :
 *   - apiKeyHash  (string)  -> hash SHA-256 de la clé
 *   - revokedAt   (Date|null)
 *   - lastSeenAt  (Date)
 */

import crypto from "node:crypto";
import Device from "../data/Device.js";

/**
 * Hache une clé API en clair avec SHA-256.
 * Exporté pour pouvoir être réutilisé dans la création d'appareils.
 */
export function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Génère une nouvelle clé API cryptographiquement sûre.
 * Exporté pour pouvoir être appelé dans le contrôleur POST /v1/devices.
 */
export function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Helper pour construire une réponse d'erreur conforme à l'enveloppe du protocole.
 */
function errorResponse(code, message) {
  return {
    status: "error",
    error: { code, message },
    meta: { generatedAt: new Date().toISOString() },
  };
}

/**
 * Middleware : exige une clé API valide.
 *
 * Comportement :
 *   - En-tête `Authorization` absent ou mal formé   -> 401 MISSING_AUTH
 *   - Clé inconnue ou révoquée                       -> 403 FORBIDDEN
 *   - Clé valide                                     -> attache `req.device` et passe au suivant
 *
 * Effet secondaire : met à jour `lastSeenAt` sur le device (best-effort, ne bloque pas).
 */
export async function requireApiKey(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json(errorResponse("MISSING_AUTH", "En-tête Authorization manquant ou mal formé."));
  }

  const apiKey = authHeader.slice("Bearer ".length).trim();

  if (apiKey.length === 0) {
    return res
      .status(401)
      .json(errorResponse("MISSING_AUTH", "Clé API absente."));
  }

  try {
    const device = await Device.findOne({ apiKeyHash: hashApiKey(apiKey) });

    if (!device || device.revokedAt) {
      return res
        .status(403)
        .json(errorResponse("FORBIDDEN", "Clé API invalide ou révoquée."));
    }

    // Met à jour lastSeenAt sans bloquer la requête (best-effort)
    Device.updateOne({ _id: device._id }, { lastSeenAt: new Date() }).catch((err) => {
      console.warn("Échec mise à jour lastSeenAt:", err.message);
    });

    req.device = device;
    return next();
  } catch (err) {
    console.error("Erreur middleware auth:", err);
    return res
      .status(500)
      .json(errorResponse("INTERNAL_ERROR", "Erreur lors de la vérification de la clé API."));
  }
}
