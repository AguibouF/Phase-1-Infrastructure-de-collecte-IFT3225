// Calculs sémantiques : transformer mesures + observations en réponses utiles.

// Sous-ensembles des documents nécessaires aux calculs (découplés de Mongoose).
export interface MeasurementLike {
  type: string;
  value: number;
  timestamp: Date;
}

export interface ObservationLike {
  density: string;
  proximity: string;
  vibe: string;
}

export type AmbianceLabel = 'calme' | 'modéré' | 'animé' | 'bruyant' | 'inconnu';

export const DENSITY_SCORE: Record<string, number> = { Vide: 10, 'Modéré': 40, 'Fréquenté': 70, 'Bondé': 95 };

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function mode<T>(values: T[]): T | null {
  if (!values.length) return null;
  const counts = new Map<T, number>();
  let best = values[0];
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) || 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

// Étiquette d'ambiance dérivée du niveau sonore moyen.
export function ambianceLabel(noise: number | null): AmbianceLabel {
  if (noise == null) return 'inconnu';
  if (noise < 50) return 'calme';
  if (noise < 65) return 'modéré';
  if (noise < 75) return 'animé';
  return 'bruyant';
}

function occupancyFromDensities(densities: string[]): number | null {
  const scores = densities.map((d) => DENSITY_SCORE[d]).filter((n): n is number => n != null);
  return avg(scores);
}

export interface NowPortrait {
  location: string;
  generatedAt: string;
  window: string;
  sampleSize: { measurements: number; observations: number };
  score: {
    noise: number | null;
    occupancy: number | null;
    vibe: string | null;
    proximity: string | null;
  };
  ambianceLabel: AmbianceLabel;
  // Renseigné quand la fenêtre courante est vide : dernière ambiance calculable,
  // datée, pour que le client puisse l'afficher comme information périmée.
  lastKnown?: { ambianceLabel: AmbianceLabel; noise: number | null; asOf: string };
}

// Portrait actuel d'un lieu sur une fenêtre donnée.
export function buildNow(
  location: string,
  measurements: MeasurementLike[],
  observations: ObservationLike[],
  window: string
): NowPortrait {
  const noises = measurements.filter((m) => m.type === 'noise_level').map((m) => m.value);
  const avgNoise = avg(noises);
  const densities = observations.map((o) => o.density);
  const occupancy = occupancyFromDensities(densities);
  return {
    location,
    generatedAt: new Date().toISOString(),
    window,
    sampleSize: { measurements: measurements.length, observations: observations.length },
    score: {
      noise: avgNoise == null ? null : Math.round(avgNoise),
      occupancy: occupancy == null ? null : Math.round(occupancy),
      vibe: mode(observations.map((o) => o.vibe)),
      proximity: mode(observations.map((o) => o.proximity)),
    },
    ambianceLabel: ambianceLabel(avgNoise),
  };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface QuietSlot {
  dayOfWeek: string;
  from: string;
  to: string;
  avgNoise: number;
  samples: number;
}

interface QuietHoursOptions {
  thresholdDb: number;
  days: number;
  dayOfWeek: number | null;
}

// Créneaux exprimés en heure locale de Montréal (America/Montreal, changement
// d'heure inclus) : « lundi 09:00 » correspond à ce que vivent les usagers sur
// place, pas à l'heure UTC de stockage.
const MONTREAL_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Montreal',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function montrealDayMinutes(date: Date): { dow: number; minutes: number } {
  const parts = MONTREAL_TIME.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    dow: WEEKDAY_INDEX[get('weekday')],
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

// Regroupe les mesures par (jour, créneau de 30 min) et garde celles sous le seuil.
export function buildQuietHours(measurements: MeasurementLike[], { thresholdDb, dayOfWeek }: QuietHoursOptions): QuietSlot[] {
  const buckets: Record<string, { sum: number; n: number; day: number; fromMin: number }> = {};
  for (const m of measurements) {
    if (m.type !== 'noise_level') continue;
    const { dow, minutes } = montrealDayMinutes(new Date(m.timestamp));
    if (dayOfWeek != null && dow !== dayOfWeek) continue;
    const slot = Math.floor(minutes / 30) * 30;
    const key = `${dow}-${slot}`;
    if (!buckets[key]) buckets[key] = { sum: 0, n: 0, day: dow, fromMin: slot };
    buckets[key].sum += m.value;
    buckets[key].n += 1;
  }
  const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  return Object.values(buckets)
    .map((b) => ({
      dayOfWeek: DAYS[b.day],
      from: fmt(b.fromMin),
      to: fmt(b.fromMin + 30),
      avgNoise: Math.round((b.sum / b.n) * 10) / 10,
      samples: b.n,
    }))
    .filter((s) => s.avgNoise <= thresholdDb)
    .sort((a, b) => a.avgNoise - b.avgNoise);
}

export interface HistoryBucket {
  bucketStart: string;
  avgNoise: number;
  samples: number;
}

// Série temporelle agrégée par tranche (bucket).
export function buildHistory(measurements: MeasurementLike[], bucketMs: number): HistoryBucket[] {
  const buckets: Record<number, number[]> = {};
  for (const m of measurements) {
    if (m.type !== 'noise_level') continue;
    const t = new Date(m.timestamp).getTime();
    const start = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets[start]) buckets[start] = [];
    buckets[start].push(m.value);
  }
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((start) => ({
      bucketStart: new Date(start).toISOString(),
      avgNoise: Math.round((avg(buckets[start]) as number) * 10) / 10,
      samples: buckets[start].length,
    }));
}
