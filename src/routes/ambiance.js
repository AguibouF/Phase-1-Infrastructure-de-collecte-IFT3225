/**
 * Ressource `/v1/ambiance/*` — endpoints sémantiques (logique + routes).
 *
 * Ces endpoints ne stockent rien. Ils agrègent à la demande les ressources
 * persistées (`measurements` et `observations`) pour produire un portrait
 * synthétique de l'ambiance d'un lieu.
 *
 * IMPORTANT — ordre d'enregistrement (voir bas du fichier) :
 *   `/compare` doit être déclaré AVANT les routes paramétrées `/:locationSlug/...`,
 *   sinon Express interprète "compare" comme la valeur de `locationSlug`.
 *
 * Toutes les routes sont publiques (lecture, pas d'authentification requise).
 */

import { Router } from "express";

import Measurement from "../data/Measurement.js";
import Observation from "../data/Observation.js";
import Location from "../data/Location.js";

import { success, failure } from "../utils/response.js";
import { parseDuration, parseBucket, resolveTimeWindow } from "../utils/time.js";

// ----------------------------------------------------------------------------
// Seuils de classification (calibration initiale, à ajuster après session 1)
// ----------------------------------------------------------------------------

const NOISE_THRESHOLDS = [
  { max: 45, label: "calme" },
  { max: 60, label: "modéré" },
  { max: 75, label: "animé" },
  { max: Infinity, label: "bruyant" },
];

const DENSITY_TO_OCCUPANCY = {
  Vide: 0,
  Modéré: 33,
  Fréquenté: 66,
  Bondé: 100,
};

const DEFAULT_QUIET_THRESHOLD = 55; // dB
const DEFAULT_QUIET_DAYS = 30;

// ----------------------------------------------------------------------------
// Helpers internes
// ----------------------------------------------------------------------------

function classifyNoise(value) {
  if (value === null || value === undefined || isNaN(value)) return "inconnu";
  return NOISE_THRESHOLDS.find((t) => value < t.max).label;
}

function mostFrequent(values) {
  const filtered = values.filter((v) => v !== null && v !== undefined);
  if (filtered.length === 0) return null;
  const counts = filtered.reduce((map, item) => {
    map[item] = (map[item] || 0) + 1;
    return map;
  }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function round1(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

async function locationExists(slug) {
  const found = await Location.findOne({ slug }).lean();
  return Boolean(found);
}

function dayOfWeekLabel(index) {
  // Mongo $dayOfWeek: dimanche=1, lundi=2, ..., samedi=7
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[index - 1];
}

// ----------------------------------------------------------------------------
// GET /v1/ambiance/:locationSlug/now
// ----------------------------------------------------------------------------

async function getNow(req, res, next) {
  try {
    const { locationSlug } = req.params;
    const window = req.query.window || "30m";

    let windowMs;
    try {
      windowMs = parseDuration(window);
    } catch (e) {
      return res.status(400).json(failure("VALIDATION_ERROR", e.message));
    }

    if (!(await locationExists(locationSlug))) {
      return res.status(404).json(failure("LOCATION_NOT_FOUND", `Lieu introuvable: ${locationSlug}`));
    }

    const since = new Date(Date.now() - windowMs);

    // Moyenne du niveau sonore sur la fenêtre
    const [noiseAgg] = await Measurement.aggregate([
      { $match: { locationSlug, type: "noise_level", timestamp: { $gte: since } } },
      { $group: { _id: null, avgNoise: { $avg: "$value" }, count: { $sum: 1 } } },
    ]);

    const avgNoise = noiseAgg?.avgNoise ?? null;
    const measurementCount = noiseAgg?.count ?? 0;

    // Observations dans la fenêtre
    const observations = await Observation.find({
      locationSlug,
      timestamp: { $gte: since },
    }).lean();

    let vibe = null;
    let proximity = null;
    let occupancy = null;

    if (observations.length > 0) {
      vibe = mostFrequent(observations.map((o) => o.vibe));
      proximity = mostFrequent(observations.map((o) => o.proximity));
      const occupancyValues = observations
        .map((o) => DENSITY_TO_OCCUPANCY[o.density])
        .filter((v) => v !== undefined);
      if (occupancyValues.length > 0) {
        occupancy = Math.round(
          occupancyValues.reduce((a, b) => a + b, 0) / occupancyValues.length
        );
      }
    }

    return res.json(
      success({
        location: locationSlug,
        generatedAt: new Date().toISOString(),
        window,
        score: {
          noise: round1(avgNoise),
          occupancy,
          vibe,
          proximity,
        },
        ambianceLabel: classifyNoise(avgNoise),
        sampleCounts: {
          measurements: measurementCount,
          observations: observations.length,
        },
      })
    );
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// GET /v1/ambiance/:locationSlug/quiet-hours
// ----------------------------------------------------------------------------

async function getQuietHours(req, res, next) {
  try {
    const { locationSlug } = req.params;
    const days = parseInt(req.query.days ?? DEFAULT_QUIET_DAYS, 10);
    const threshold = parseFloat(req.query.threshold ?? DEFAULT_QUIET_THRESHOLD);
    const filterDayOfWeek = req.query.dayOfWeek !== undefined
      ? parseInt(req.query.dayOfWeek, 10)
      : null;

    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "Paramètre 'days' invalide (1-365)."));
    }
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 140) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "Paramètre 'threshold' invalide (0-140 dB)."));
    }
    if (filterDayOfWeek !== null && (filterDayOfWeek < 0 || filterDayOfWeek > 6)) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "Paramètre 'dayOfWeek' invalide (0=dim, 6=sam)."));
    }

    if (!(await locationExists(locationSlug))) {
      return res
        .status(404)
        .json(failure("LOCATION_NOT_FOUND", `Lieu introuvable: ${locationSlug}`));
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Agrégation : moyenne par (jour de semaine, heure)
    const pipeline = [
      { $match: { locationSlug, type: "noise_level", timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: "$timestamp" },
            hour: { $hour: "$timestamp" },
          },
          avgNoise: { $avg: "$value" },
          count: { $sum: 1 },
        },
      },
      { $match: { avgNoise: { $lt: threshold } } },
      { $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
    ];

    let buckets = await Measurement.aggregate(pipeline);

    // Filtre par jour de la semaine si demandé (0=dim, 6=sam côté client → 1-7 côté Mongo)
    if (filterDayOfWeek !== null) {
      const mongoDay = filterDayOfWeek + 1;
      buckets = buckets.filter((b) => b._id.dayOfWeek === mongoDay);
    }

    // Fusion des heures adjacentes en plages "from / to"
    const slots = [];
    for (const bucket of buckets) {
      const last = slots[slots.length - 1];
      const sameDay = last && last._dayOfWeek === bucket._id.dayOfWeek;
      const adjacent = last && bucket._id.hour === last._lastHour + 1;

      if (sameDay && adjacent) {
        last._lastHour = bucket._id.hour;
        last.to = `${String(bucket._id.hour + 1).padStart(2, "0")}:00`;
        last._noiseValues.push(bucket.avgNoise);
        last._counts += bucket.count;
      } else {
        slots.push({
          dayOfWeek: dayOfWeekLabel(bucket._id.dayOfWeek),
          from: `${String(bucket._id.hour).padStart(2, "0")}:00`,
          to: `${String(bucket._id.hour + 1).padStart(2, "0")}:00`,
          _dayOfWeek: bucket._id.dayOfWeek,
          _lastHour: bucket._id.hour,
          _noiseValues: [bucket.avgNoise],
          _counts: bucket.count,
        });
      }
    }

    // Nettoyage : calcule avgNoise du créneau fusionné, supprime les champs internes
    const quietSlots = slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      from: s.from,
      to: s.to,
      avgNoise: round1(s._noiseValues.reduce((a, b) => a + b, 0) / s._noiseValues.length),
      samples: s._counts,
    }));

    return res.json(
      success({
        location: locationSlug,
        analysisPeriodDays: days,
        threshold,
        quietSlots,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// GET /v1/ambiance/compare
// ----------------------------------------------------------------------------

async function getCompare(req, res, next) {
  try {
    const locationsParam = req.query.locations;
    const window = req.query.window || "30m";

    if (!locationsParam) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "Paramètre 'locations' obligatoire (slugs séparés par virgule)."));
    }

    const slugs = locationsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (slugs.length < 2) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "Au moins 2 lieux requis pour une comparaison."));
    }

    let windowMs;
    try {
      windowMs = parseDuration(window);
    } catch (e) {
      return res.status(400).json(failure("VALIDATION_ERROR", e.message));
    }

    // Vérifier que tous les lieux existent
    const existingLocations = await Location.find({ slug: { $in: slugs } }).lean();
    const existingSlugs = new Set(existingLocations.map((l) => l.slug));
    const missing = slugs.filter((s) => !existingSlugs.has(s));

    if (missing.length > 0) {
      return res
        .status(404)
        .json(failure("LOCATION_NOT_FOUND", `Lieux introuvables: ${missing.join(", ")}`));
    }

    const since = new Date(Date.now() - windowMs);

    // Une seule agrégation pour tous les lieux
    const noiseAggs = await Measurement.aggregate([
      {
        $match: {
          locationSlug: { $in: slugs },
          type: "noise_level",
          timestamp: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$locationSlug",
          avgNoise: { $avg: "$value" },
          count: { $sum: 1 },
        },
      },
    ]);

    const byLocation = new Map(noiseAggs.map((a) => [a._id, a]));

    const comparison = slugs.map((slug) => {
      const agg = byLocation.get(slug);
      const avgNoise = agg?.avgNoise ?? null;
      return {
        location: slug,
        score: { noise: round1(avgNoise) },
        ambianceLabel: classifyNoise(avgNoise),
        samples: agg?.count ?? 0,
      };
    });

    // Identification de quietest / busiest (en ignorant les lieux sans données)
    const ranked = comparison
      .filter((c) => c.score.noise !== null)
      .sort((a, b) => a.score.noise - b.score.noise);

    const quietest = ranked[0]?.location ?? null;
    const busiest = ranked[ranked.length - 1]?.location ?? null;

    return res.json(
      success({
        window,
        comparison,
        quietest,
        busiest,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// GET /v1/ambiance/:locationSlug/history
// ----------------------------------------------------------------------------

async function getHistory(req, res, next) {
  try {
    const { locationSlug } = req.params;
    const bucketStr = req.query.bucket || "15m";
    const { last, from, to } = req.query;

    let since, until;
    try {
      ({ since, until } = resolveTimeWindow({ last, from, to }));
    } catch (e) {
      return res
        .status(400)
        .json(failure(e.code || "VALIDATION_ERROR", e.message));
    }

    let bucketParam;
    try {
      bucketParam = parseBucket(bucketStr);
    } catch (e) {
      return res.status(400).json(failure("VALIDATION_ERROR", e.message));
    }

    if (!(await locationExists(locationSlug))) {
      return res
        .status(404)
        .json(failure("LOCATION_NOT_FOUND", `Lieu introuvable: ${locationSlug}`));
    }

    const series = await Measurement.aggregate([
      {
        $match: {
          locationSlug,
          type: "noise_level",
          timestamp: { $gte: since, $lte: until },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$timestamp",
              unit: bucketParam.unit,
              binSize: bucketParam.binSize,
            },
          },
          avgNoise: { $avg: "$value" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formattedSeries = series.map((point) => ({
      at: point._id.toISOString(),
      avgNoise: round1(point.avgNoise),
      ambianceLabel: classifyNoise(point.avgNoise),
      samples: point.count,
    }));

    return res.json(
      success({
        location: locationSlug,
        window: { from: since.toISOString(), to: until.toISOString() },
        bucket: bucketStr,
        series: formattedSeries,
      })
    );
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// Enregistrement des routes
//
// ORDRE CRITIQUE : `/compare` AVANT les routes paramétrées `/:locationSlug/...`
// ----------------------------------------------------------------------------

const router = Router();

router.get("/compare", getCompare);
router.get("/:locationSlug/now", getNow);
router.get("/:locationSlug/quiet-hours", getQuietHours);
router.get("/:locationSlug/history", getHistory);

export default router;
