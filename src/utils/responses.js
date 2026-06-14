// Helpers pour l'enveloppe standard { status, data, meta }.
function meta(extra = {}) {
  return { generatedAt: new Date().toISOString(), ...extra };
}

function success(res, status, data, metaExtra = {}) {
  return res.status(status).json({ status: 'success', data, meta: meta(metaExtra) });
}

// Erreur applicative transportée jusqu'au errorHandler central.
class ApiError extends Error {
  constructor(httpStatus, code, message, details) {
    super(message);
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

// Raccourcis vers les codes machine définis dans le rapport (table des erreurs).
const errors = {
  validation: (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details),
  missingAuth: (message = 'Authentification absente.') => new ApiError(401, 'MISSING_AUTH', message),
  forbidden: (message = 'Clé invalide ou accès refusé.') => new ApiError(403, 'FORBIDDEN', message),
  locationNotFound: (message = 'Lieu inexistant ou slug incorrect.') =>
    new ApiError(404, 'LOCATION_NOT_FOUND', message),
  notFound: (message = 'Ressource introuvable.') => new ApiError(404, 'NOT_FOUND', message),
  conflict: (code, message) => new ApiError(409, code, message),
  invalidValue: (message, details) => new ApiError(422, 'INVALID_VALUE', message, details),
  rateLimit: (message = 'Trop de requêtes.') => new ApiError(429, 'RATE_LIMIT', message),
};

module.exports = { success, meta, ApiError, errors };
