// Calculs sémantiques : transformer mesures + observations en réponses utiles.
const DENSITY_SCORE = { 'Vide': 10, 'Modéré': 40, 'Fréquenté': 70, 'Bondé': 95 };

function avg(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mode(values) {
  if (!values.length) return null;
  const counts = {};
  let best = values[0];
  let bestN = 0;
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > bestN) {
      bestN = counts[v];
      best = v;
    }
  }
  return best;
}

// Étiquette d'ambiance dérivée du niveau sonore moyen.
function ambianceLabel(noise) {
  if (noise == null) return 'inconnu';
  if (noise < 50) return 'calme';
  if (noise < 65) return 'modéré';
  if (noise < 75) return 'animé';
  return 'bruyant';
}

function occupancyFromDensities(densities) {
  const scores = densities.map((d) => DENSITY_SCORE[d]).filter((n) => n != null);
  return avg(scores);
}

// Portrait actuel d'un lieu sur une fenêtre donnée.
function buildNow(location, measurements, observations, window) {
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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Regroupe les mesures par (jour, créneau de 30 min) et garde celles sous le seuil.
function buildQuietHours(measurements, { thresholdDb, days, dayOfWeek }) {
  const buckets = {}; // key -> { sum, n, day, fromMin }
  for (const m of measurements) {
    if (m.type !== 'noise_level') continue;
    const d = new Date(m.timestamp);
    const dow = d.getUTCDay();
    if (dayOfWeek != null && dow !== dayOfWeek) continue;
    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    const slot = Math.floor(minutes / 30) * 30;
    const key = `${dow}-${slot}`;
    if (!buckets[key]) buckets[key] = { sum: 0, n: 0, day: dow, fromMin: slot };
    buckets[key].sum += m.value;
    buckets[key].n += 1;
  }
  const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
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

// Série temporelle agrégée par tranche (bucket).
function buildHistory(measurements, bucketMs) {
  const buckets = {};
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
      avgNoise: Math.round(avg(buckets[start]) * 10) / 10,
      samples: buckets[start].length,
    }));
}

module.exports = { buildNow, buildQuietHours, buildHistory, ambianceLabel, avg, mode, DENSITY_SCORE };
