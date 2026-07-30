// Couche service : logique métier de l'ambiance, découplée d'Express et de
// Mongoose. Toutes les fonctions sont pures (entrées → sortie déterministe) et
// donc testables sans serveur ni base de données (Tâche 3). Elles composent les
// calculs de bas niveau de `utils/ambiance`.

import {
  buildNow,
  buildQuietHours,
  buildHistory,
  type MeasurementLike,
  type ObservationLike,
  type NowPortrait,
  type QuietSlot,
  type HistoryBucket,
} from '../utils/ambiance';

export type { NowPortrait, QuietSlot, HistoryBucket };

// Portrait actuel d'un lieu (fenêtre glissante). Simple délégation nommée pour
// exposer une frontière « service » claire aux routes.
export function getNowPortrait(
  slug: string,
  measurements: MeasurementLike[],
  observations: ObservationLike[],
  window: string
): NowPortrait {
  return buildNow(slug, measurements, observations, window);
}

// Créneaux calmes d'un lieu sur une période, sous un seuil sonore.
export function getQuietHours(
  measurements: MeasurementLike[],
  opts: { thresholdDb: number; days: number; dayOfWeek: number | null }
): QuietSlot[] {
  return buildQuietHours(measurements, opts);
}

// Série temporelle agrégée par tranche.
export function getHistorySeries(measurements: MeasurementLike[], bucketMs: number): HistoryBucket[] {
  return buildHistory(measurements, bucketMs);
}

// --- Tâche 1 : recommandation « où aller maintenant » ---------------------

export interface RankedRecommendation {
  ranked: NowPortrait[]; // lieux mesurables, du plus calme au plus animé
  unknown: NowPortrait[]; // lieux sans mesure exploitable dans la fenêtre
  quietest: string | null;
  busiest: string | null;
}

// Classe une liste de portraits par niveau sonore croissant (le plus calme
// d'abord). Les lieux sans mesure (`score.noise == null`) sont écartés du
// classement et renvoyés à part, pour que le client puisse les afficher
// distinctement plutôt que de les faire disparaître.
export function rankByAmbiance(portraits: NowPortrait[]): RankedRecommendation {
  const ranked = portraits
    .filter((p) => p.score.noise != null)
    .sort((a, b) => (a.score.noise as number) - (b.score.noise as number));
  const unknown = portraits.filter((p) => p.score.noise == null);
  return {
    ranked,
    unknown,
    quietest: ranked.length ? ranked[0].location : null,
    busiest: ranked.length ? ranked[ranked.length - 1].location : null,
  };
}
