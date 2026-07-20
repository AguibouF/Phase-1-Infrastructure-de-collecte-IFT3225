import express, { Request, Response, NextFunction } from 'express';
import Observation, { DENSITY, VIBE, PROXIMITY, Density, Vibe, Proximity } from '../models/Observation';
import Location from '../models/Location';
import { success, errors, ErrorDetail } from '../utils/responses';
import { parsePagination, paginationMeta } from '../utils/pagination';
import { buildTimeWindow, isValidDate } from '../utils/time';
import { deviceAuth } from '../middlewares/auth';
import { userAuth } from '../middlewares/userAuth';
import { emitAmbianceEvent } from '../utils/events';

const router = express.Router();

interface ObservationBody {
  locationSlug?: string;
  density?: string;
  proximity?: string;
  vibe?: string;
  notes?: string;
  timestamp?: string;
}

function validateVocabularies(b: ObservationBody): ErrorDetail[] {
  const invalid: ErrorDetail[] = [];
  if (!DENSITY.includes(b.density as Density)) invalid.push({ field: 'density', issue: 'unsupported' });
  if (!VIBE.includes(b.vibe as Vibe)) invalid.push({ field: 'vibe', issue: 'unsupported' });
  if (!PROXIMITY.includes(b.proximity as Proximity)) invalid.push({ field: 'proximity', issue: 'unsupported' });
  return invalid;
}

// POST /v1/observations — protégé (x-api-key)
router.post('/', deviceAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = (req.body || {}) as ObservationBody;
    const missing: ErrorDetail[] = [];
    for (const f of ['locationSlug', 'density', 'proximity', 'vibe', 'timestamp'] as const) {
      if (!b[f]) missing.push({ field: f, issue: 'missing' });
    }
    if (b.timestamp && !isValidDate(new Date(b.timestamp))) missing.push({ field: 'timestamp', issue: 'invalid_format' });
    if (missing.length) throw errors.validation('Observation invalide.', missing);

    const invalid = validateVocabularies(b);
    if (invalid.length) throw errors.invalidValue("Valeur d'observation invalide.", invalid);

    if (!(await Location.findOne({ slug: String(b.locationSlug).toLowerCase() }))) throw errors.locationNotFound();
    const o = await Observation.create({
      locationSlug: b.locationSlug, density: b.density, proximity: b.proximity,
      vibe: b.vibe, notes: b.notes || '', timestamp: new Date(b.timestamp as string),
    });
    emitAmbianceEvent('observation', o.locationSlug); // temps réel (SSE)
    success(res, 201, o.toJSON());
  } catch (e) { next(e); }
});

// POST /v1/observations/user — protégé (JWT token utilisateur)
router.post('/user', userAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = (req.body || {}) as ObservationBody;
    const missing: ErrorDetail[] = [];
    for (const f of ['locationSlug', 'density', 'proximity', 'vibe'] as const) {
      if (!b[f]) missing.push({ field: f, issue: 'missing' });
    }
    if (missing.length) throw errors.validation('Observation invalide.', missing);

    const invalid = validateVocabularies(b);
    if (invalid.length) throw errors.invalidValue("Valeur d'observation invalide.", invalid);

    if (!(await Location.findOne({ slug: String(b.locationSlug).toLowerCase() }))) throw errors.locationNotFound();

    const o = await Observation.create({
      locationSlug: b.locationSlug,
      density: b.density,
      proximity: b.proximity,
      vibe: b.vibe,
      notes: b.notes || '',
      timestamp: new Date(),
      author: req.user?.userId, // Lier l'observation à l'utilisateur
    });
    emitAmbianceEvent('observation', o.locationSlug); // temps réel (SSE)
    success(res, 201, o.toJSON());
  } catch (e) { next(e); }
});

// GET /v1/observations — public, paginé/filtré
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = buildTimeWindow(req.query, 'timestamp');
    if (req.query.locationSlug) filter.locationSlug = String(req.query.locationSlug).toLowerCase();
    if (req.query.vibe) filter.vibe = req.query.vibe;
    if (req.query.density) filter.density = req.query.density;
    const { page, perPage, skip, sort } = parsePagination(req.query, {
      maxPerPage: parseInt(process.env.MAX_PER_PAGE || '', 10) || 200,
      defaultSort: 'timestamp:desc',
      sortableFields: ['timestamp', 'receivedAt'],
    });
    const [items, total] = await Promise.all([
      Observation.find(filter).sort(sort).skip(skip).limit(perPage),
      Observation.countDocuments(filter),
    ]);
    success(res, 200, items.map((d) => d.toJSON()), paginationMeta(page, perPage, total));
  } catch (e) { next(e); }
});

export default router;
