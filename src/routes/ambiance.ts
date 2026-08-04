import express, { Request, Response, NextFunction } from 'express';
import Measurement from '../models/Measurement';
import Observation from '../models/Observation';
import Location, { LocationDocument } from '../models/Location';
import { success, errors } from '../utils/responses';
import { parseDuration } from '../utils/time';
import { buildNow, buildQuietHours, buildHistory, NowPortrait, ambianceLabel, avg } from '../utils/ambiance';
import { rankByAmbiance } from '../services/ambianceService';
import { cacheControl } from '../middlewares/cache';
import cacheService from '../services/cacheService';

const router = express.Router();

async function ensureLocation(slug: string): Promise<LocationDocument> {
  const loc = await Location.findOne({ slug: String(slug).toLowerCase() });
  if (!loc) throw errors.locationNotFound();
  return loc;
}

// Construit le portrait actuel de plusieurs lieux sur une même fenêtre.
async function portraitsForLocations(locs: LocationDocument[], windowStr: string): Promise<NowPortrait[]> {
  const ms = parseDuration(windowStr) as number;
  const since = new Date(Date.now() - ms);
  const portraits: NowPortrait[] = [];
  for (const loc of locs) {
    const [measurements, observations] = await Promise.all([
      Measurement.find({ locationSlug: loc.slug, timestamp: { $gte: since } }),
      Observation.find({ locationSlug: loc.slug, timestamp: { $gte: since } }),
    ]);
    portraits.push(buildNow(loc.slug, measurements, observations, windowStr));
  }
  return portraits;
}

// GET /v1/ambiance/where-to-go?window=30m&city=montreal&type=cafeteria
// Tâche 1 : recommande où aller MAINTENANT en classant tous les lieux (filtrables
// par ville/type) du plus calme au plus animé, en direct. Réutilise le service
// pur `rankByAmbiance` (testé) et enrichit chaque entrée du nom d'affichage et
// des coordonnées pour l'UI.
router.get('/where-to-go', cacheControl(30), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const windowStr = String(req.query.window || '30m');
    if (!['15m', '30m', '1h'].includes(windowStr)) {
      throw errors.validation('window doit être 15m, 30m ou 1h.', [{ field: 'window', issue: 'invalid' }]);
    }
    const filter: Record<string, string> = {};
    if (req.query.city) filter.city = String(req.query.city).toLowerCase();
    if (req.query.type) filter.type = String(req.query.type).toLowerCase();

    const locs = await Location.find(filter);
    const bySlug = new Map(locs.map((l) => [l.slug, l]));
    const portraits = await portraitsForLocations(locs, windowStr);
    const { ranked, unknown, quietest, busiest } = rankByAmbiance(portraits);

    // Enrichit un portrait des métadonnées du lieu pour l'affichage client.
    const enrich = (p: NowPortrait) => {
      const loc = bySlug.get(p.location);
      return {
        ...p,
        displayName: loc?.displayName ?? p.location,
        type: loc?.type ?? null,
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
      };
    };

    success(res, 200, {
      window: windowStr,
      count: ranked.length,
      ranked: ranked.map(enrich),
      unknown: unknown.map(enrich),
      quietest,
      busiest,
    });
  } catch (e) { next(e); }
});

// GET /v1/ambiance/compare?locations=a,b,c&window=30m
// Déclaré avant les routes paramétrées pour éviter la capture par :locationSlug.
router.get('/compare', cacheControl(30), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.query.locations) throw errors.validation('Paramètre "locations" requis (slugs séparés par des virgules).', [{ field: 'locations', issue: 'missing' }]);
    const slugs = String(req.query.locations).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const windowStr = String(req.query.window || '30m');
    if (!parseDuration(windowStr)) throw errors.validation('window invalide (ex: 15m, 30m, 1h).', [{ field: 'window', issue: 'invalid' }]);

    const locs: LocationDocument[] = [];
    for (const slug of slugs) {
      const loc = await Location.findOne({ slug });
      if (!loc) throw errors.locationNotFound(`Lieu inconnu: ${slug}`);
      locs.push(loc);
    }
    const results = await portraitsForLocations(locs, windowStr);
    // Classement calculé par le service pur testé (rankByAmbiance) ; `results`
    // reste dans l'ordre demandé par le client.
    const { quietest, busiest } = rankByAmbiance(results);
    success(res, 200, { window: windowStr, locations: results, quietest, busiest });
  } catch (e) { next(e); }
});

// GET /v1/ambiance/:locationSlug/now?window=30m
router.get('/:locationSlug/now', cacheControl(30), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureLocation(req.params.locationSlug);
    const windowStr = String(req.query.window || '30m');
    if (!['15m', '30m', '1h'].includes(windowStr)) throw errors.validation('window doit être 15m, 30m ou 1h.', [{ field: 'window', issue: 'invalid' }]);
    const since = new Date(Date.now() - (parseDuration(windowStr) as number));
    const slug = String(req.params.locationSlug).toLowerCase();
    const [ms_, obs] = await Promise.all([
      Measurement.find({ locationSlug: slug, timestamp: { $gte: since } }),
      Observation.find({ locationSlug: slug, timestamp: { $gte: since } }),
    ]);
    const portrait = buildNow(slug, ms_, obs, windowStr);
    // Fenêtre courante vide : on joint la dernière ambiance calculable (fenêtre de
    // même durée se terminant à la dernière mesure), datée, pour que le client
    // puisse afficher une information périmée plutôt que rien. Au-delà de
    // LAST_KNOWN_MAX_AGE_MS sans mesure, l'information est jugée trop ancienne
    // pour être utile : lastKnown est omis et le lieu redevient « données non
    // disponibles ».
    const LAST_KNOWN_MAX_AGE_MS = 2 * 3600e3;
    if (portrait.ambianceLabel === 'inconnu') {
      const latest = await Measurement.findOne({ locationSlug: slug, type: 'noise_level' }).sort({ timestamp: -1 });
      if (latest && Date.now() - latest.timestamp.getTime() <= LAST_KNOWN_MAX_AGE_MS) {
        const windowMs = parseDuration(windowStr) as number;
        const lastMs = await Measurement.find({
          locationSlug: slug,
          type: 'noise_level',
          timestamp: { $gte: new Date(latest.timestamp.getTime() - windowMs), $lte: latest.timestamp },
        });
        const lastNoise = avg(lastMs.map((m) => m.value));
        portrait.lastKnown = {
          ambianceLabel: ambianceLabel(lastNoise),
          noise: lastNoise == null ? null : Math.round(lastNoise),
          asOf: latest.timestamp.toISOString(),
        };
      }
    }
    success(res, 200, portrait);
  } catch (e) { next(e); }
});

// GET /v1/ambiance/:locationSlug/quiet-hours?days=30&threshold=55&dayOfWeek=1
router.get('/:locationSlug/quiet-hours', cacheControl(300), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureLocation(req.params.locationSlug);
    const days = parseInt(String(req.query.days), 10) || 30;
    if (![7, 14, 30].includes(days)) throw errors.validation('days doit être 7, 14 ou 30.', [{ field: 'days', issue: 'invalid' }]);
    const thresholdDb = req.query.threshold !== undefined ? Number(req.query.threshold) : 55;
    if (Number.isNaN(thresholdDb)) throw errors.validation('threshold doit être un nombre (dB).', [{ field: 'threshold', issue: 'invalid' }]);
    let dayOfWeek: number | null = null;
    if (req.query.dayOfWeek !== undefined) {
      dayOfWeek = parseInt(String(req.query.dayOfWeek), 10);
      if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw errors.validation('dayOfWeek doit être un entier de 0 à 6.', [{ field: 'dayOfWeek', issue: 'invalid' }]);
    }
    const slug = String(req.params.locationSlug).toLowerCase();
    const since = new Date(Date.now() - days * 86400e3);
    const measurements = await Measurement.find({ locationSlug: slug, type: 'noise_level', timestamp: { $gte: since } });
    const quietSlots = buildQuietHours(measurements, { thresholdDb, days, dayOfWeek });
    success(res, 200, { location: slug, analysisPeriodDays: days, threshold: thresholdDb, quietSlots });
  } catch (e) { next(e); }
});

// GET /v1/ambiance/:locationSlug/history?last=6h&bucket=30m  (ou from/to)
router.get('/:locationSlug/history', cacheControl(300), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureLocation(req.params.locationSlug);
    const bucketStr = String(req.query.bucket || '15m');
    if (!['5m', '15m', '30m', '1h'].includes(bucketStr)) throw errors.validation('bucket doit être 5m, 15m, 30m ou 1h.', [{ field: 'bucket', issue: 'invalid' }]);
    const slug = String(req.params.locationSlug).toLowerCase();

    const q: Record<string, unknown> = {};
    if (req.query.last && (req.query.from || req.query.to)) throw errors.validation('Combiner last et from/to est interdit.', [{ field: 'last', issue: 'conflict' }]);
    if (req.query.last) {
      const ms = parseDuration(req.query.last);
      if (!ms) throw errors.validation('last invalide.', [{ field: 'last', issue: 'invalid' }]);
      q.timestamp = { $gte: new Date(Date.now() - ms) };
    } else if (req.query.from || req.query.to) {
      const timestamp: { $gte?: Date; $lte?: Date } = {};
      if (req.query.from) timestamp.$gte = new Date(String(req.query.from));
      if (req.query.to) timestamp.$lte = new Date(String(req.query.to));
      q.timestamp = timestamp;
    } else {
      q.timestamp = { $gte: new Date(Date.now() - 6 * 3600e3) }; // défaut: 6h
    }
    q.locationSlug = slug;
    q.type = 'noise_level';
    const measurements = await Measurement.find(q).sort({ timestamp: 1 });
    success(res, 200, { location: slug, bucket: bucketStr, series: buildHistory(measurements, parseDuration(bucketStr) as number) });
  } catch (e) { next(e); }
});

export default router;
