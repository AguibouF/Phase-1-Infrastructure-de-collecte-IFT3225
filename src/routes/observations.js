const express = require('express');
const Observation = require('../models/Observation');
const { DENSITY, VIBE, PROXIMITY } = require('../models/Observation');
const Location = require('../models/Location');
const { success, errors } = require('../utils/responses');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { buildTimeWindow, isValidDate } = require('../utils/time');
const { deviceAuth } = require('../middlewares/auth');

const router = express.Router();

// POST /v1/observations — protégé (x-api-key)
router.post('/', deviceAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const missing = [];
    for (const f of ['locationSlug', 'density', 'proximity', 'vibe', 'timestamp']) if (!b[f]) missing.push({ field: f, issue: 'missing' });
    if (b.timestamp && !isValidDate(new Date(b.timestamp))) missing.push({ field: 'timestamp', issue: 'invalid_format' });
    if (missing.length) throw errors.validation('Observation invalide.', missing);

    const invalid = [];
    if (!DENSITY.includes(b.density)) invalid.push({ field: 'density', issue: 'unsupported' });
    if (!VIBE.includes(b.vibe)) invalid.push({ field: 'vibe', issue: 'unsupported' });
    if (!PROXIMITY.includes(b.proximity)) invalid.push({ field: 'proximity', issue: 'unsupported' });
    if (invalid.length) throw errors.invalidValue('Valeur d\'observation invalide.', invalid);

    if (!(await Location.findOne({ slug: String(b.locationSlug).toLowerCase() }))) throw errors.locationNotFound();
    const o = await Observation.create({
      locationSlug: b.locationSlug, density: b.density, proximity: b.proximity,
      vibe: b.vibe, notes: b.notes || '', timestamp: new Date(b.timestamp),
    });
    success(res, 201, o.toJSON());
  } catch (e) { next(e); }
});

// GET /v1/observations — public, paginé/filtré
router.get('/', async (req, res, next) => {
  try {
    const filter = buildTimeWindow(req.query, 'timestamp');
    if (req.query.locationSlug) filter.locationSlug = String(req.query.locationSlug).toLowerCase();
    if (req.query.vibe) filter.vibe = req.query.vibe;
    if (req.query.density) filter.density = req.query.density;
    const { page, perPage, skip, sort } = parsePagination(req.query, {
      maxPerPage: parseInt(process.env.MAX_PER_PAGE, 10) || 200,
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

module.exports = router;
