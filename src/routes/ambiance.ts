import express, { Request, Response, NextFunction } from 'express';
import Measurement from '../models/Measurement';
import Observation from '../models/Observation';
import Location, { LocationDocument } from '../models/Location';
import { success, errors } from '../utils/responses';
import { parseDuration } from '../utils/time';
import { buildNow, buildQuietHours, buildHistory, NowPortrait } from '../utils/ambiance';

const router = express.Router();

async function ensureLocation(slug: string): Promise<LocationDocument> {
  const loc = await Location.findOne({ slug: String(slug).toLowerCase() });
  if (!loc) throw errors.locationNotFound();
  return loc;
}

// GET /v1/ambiance/compare?locations=a,b,c&window=30m
// Déclaré avant les routes paramétrées pour éviter la capture par :locationSlug.
router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.query.locations) throw errors.validation('Paramètre "locations" requis (slugs séparés par des virgules).', [{ field: 'locations', issue: 'missing' }]);
    const slugs = String(req.query.locations).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const windowStr = String(req.query.window || '30m');
    const ms = parseDuration(windowStr);
    if (!ms) throw errors.validation('window invalide (ex: 15m, 30m, 1h).', [{ field: 'window', issue: 'invalid' }]);
    const since = new Date(Date.now() - ms);

    const results: NowPortrait[] = [];
    for (const slug of slugs) {
      const loc = await Location.findOne({ slug });
      if (!loc) throw errors.locationNotFound(`Lieu inconnu: ${slug}`);
      const [ms_, obs] = await Promise.all([
        Measurement.find({ locationSlug: slug, timestamp: { $gte: since } }),
        Observation.find({ locationSlug: slug, timestamp: { $gte: since } }),
      ]);
      results.push(buildNow(slug, ms_, obs, windowStr));
    }
    const ranked = results.filter((r) => r.score.noise != null);
    const quietest = ranked.length ? ranked.reduce((a, b) => ((b.score.noise as number) < (a.score.noise as number) ? b : a)).location : null;
    const busiest = ranked.length ? ranked.reduce((a, b) => ((b.score.noise as number) > (a.score.noise as number) ? b : a)).location : null;
    success(res, 200, { window: windowStr, locations: results, quietest, busiest });
  } catch (e) { next(e); }
});

// GET /v1/ambiance/:locationSlug/now?window=30m
router.get('/:locationSlug/now', async (req: Request, res: Response, next: NextFunction) => {
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
    success(res, 200, buildNow(slug, ms_, obs, windowStr));
  } catch (e) { next(e); }
});

// GET /v1/ambiance/:locationSlug/quiet-hours?days=30&threshold=55&dayOfWeek=1
router.get('/:locationSlug/quiet-hours', async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/:locationSlug/history', async (req: Request, res: Response, next: NextFunction) => {
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
