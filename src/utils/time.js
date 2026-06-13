/**
 * Utilitaires de parsing temporel pour les endpoints sémantiques.
 *
 * Le protocole accepte des durées au format "Nm" (minutes), "Nh" (heures), "Nd" (jours).
 * Exemples valides : "15m", "30m", "1h", "3h", "24h", "7d", "30d".
 */

const UNIT_TO_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const UNIT_TO_MONGO = {
  m: "minute",
  h: "hour",
  d: "day",
};

/**
 * Parse une durée du protocole et retourne sa valeur en millisecondes.
 * @param {string} str  ex. "30m", "3h", "7d"
 * @returns {number}    durée en millisecondes
 * @throws {Error}      si le format est invalide
 */
export function parseDuration(str) {
  const match = /^(\d+)(m|h|d)$/.exec(str);
  if (!match) {
    throw new Error(`Format de durée invalide: "${str}". Attendu: Nm, Nh ou Nd.`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return value * UNIT_TO_MS[unit];
}

/**
 * Parse un bucket (granularité d'agrégation) et retourne les paramètres
 * pour l'opérateur Mongo $dateTrunc.
 * @param {string} str  ex. "15m", "1h"
 * @returns {{unit: string, binSize: number}}
 * @throws {Error}      si le format est invalide
 */
export function parseBucket(str) {
  const match = /^(\d+)(m|h|d)$/.exec(str);
  if (!match) {
    throw new Error(`Format de bucket invalide: "${str}". Attendu: Nm, Nh ou Nd.`);
  }
  const binSize = parseInt(match[1], 10);
  const unit = UNIT_TO_MONGO[match[2]];
  return { unit, binSize };
}

/**
 * Valide qu'une combinaison (last) ou (from/to) est cohérente.
 * Refuse explicitement la présence simultanée de `last` ET `from/to`.
 * @returns {{ since: Date, until: Date }}
 * @throws {Error} avec une `code` "VALIDATION_ERROR" si la combinaison est invalide
 */
export function resolveTimeWindow({ last, from, to }) {
  const hasLast = Boolean(last);
  const hasRange = Boolean(from) || Boolean(to);

  if (hasLast && hasRange) {
    const err = new Error("Les paramètres 'last' et 'from/to' sont mutuellement exclusifs.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const now = new Date();

  if (hasLast) {
    const ms = parseDuration(last);
    return { since: new Date(now.getTime() - ms), until: now };
  }

  if (hasRange) {
    const since = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const until = to ? new Date(to) : now;
    if (isNaN(since.getTime()) || isNaN(until.getTime())) {
      const err = new Error("Paramètres 'from' ou 'to' invalides (attendu ISO 8601).");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return { since, until };
  }

  // Défaut : 3 dernières heures
  return { since: new Date(now.getTime() - 3 * 60 * 60 * 1000), until: now };
}
