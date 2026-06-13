/**
 * Helpers d'enveloppe de réponse selon les conventions du protocole.
 *
 * Toutes les réponses suivent la structure :
 *   - Succès : { status: "success", data, meta }
 *   - Erreur : { status: "error", error: { code, message, details? }, meta }
 */

/**
 * Construit une enveloppe de succès.
 * @param {*} data            charge utile
 * @param {object} extraMeta  métadonnées additionnelles (pagination, etc.)
 */
export function success(data, extraMeta = {}) {
  return {
    status: "success",
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      ...extraMeta,
    },
  };
}

/**
 * Construit une enveloppe d'erreur.
 * @param {string} code         code machine (ex. "VALIDATION_ERROR")
 * @param {string} message      message lisible
 * @param {Array} [details]     détails optionnels par champ
 */
export function failure(code, message, details) {
  return {
    status: "error",
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Mapping des codes machine vers leur statut HTTP par défaut.
 * Utilisable pour normaliser le traitement des erreurs côté contrôleur.
 */
export const HTTP_STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  MISSING_AUTH: 401,
  FORBIDDEN: 403,
  LOCATION_NOT_FOUND: 404,
  DEVICE_EXISTS: 409,
  LOCATION_EXISTS: 409,
  INVALID_VALUE: 422,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
};
