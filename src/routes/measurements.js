const express = require('express');
const Measurement = require('../models/Measurement');
const Location = require('../models/Location');
const { success, errors } = require('../utils/responses');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { buildTimeWindow, isValidDate } = require('../utils/time');
const { deviceAuth } = require('../middlewares/auth');

const router = express.Router();

const ALLOWED_TYPE = 'noise_level';
const ALLOWED_UNIT = 'dB';

// Valide une mesure unitaire. Sépare 400 (champ manquant/mauvais format) et 422 (valeur hors plage).
function validateMeasurement(body) {
  const details = [];
  const { type, value, unit, locationSlug, timestamp } = body;
  if (!type) details.push({ field: 'type', issue: 'missing' });
  if (value === undefined || value === null) details.push({ field: 'value', issue: 'missing' });
  if (!unit) details.push({ field: 'unit', issue: 'missing' });
  if (!locationSlug) details.push({ field: 'locationSlug', issue: 'missing' });
  if (!timestamp) details.push({ field: 'timestamp', issue: 'missing' });
  if (timestamp && !isValidDate(new Date(timestamp))) details.push({ field: 'timestamp', issue: 'invalid_format' });
  if (typeof value !== 'undefined' && typeof value !== 'number') details.push({ field: 'value', issue: 'not_a_number' });
  if (details.length) return { error: errors.validation('Mesure invalide.', details) };

  // À ce stade, format OK -> on contrôle les valeurs (422).
  const invalid = [];
  if (type !== ALLOWED_TYPE) invalid.push({ field: 'type', issue: 'unsupported' });
  if (unit !== ALLOWED_UNIT) invalid.push({ field: 'unit', issue: 'unsupported' });
  if (value < 0 || value > 140) invalid.push({ field: 'value', issue: 'out_of_range' });
  if (invalid.length) return { error: errors.invalidValue('Valeur de mesure invalide.', invalid) };
  return { ok: true };
}

// POST /v1/measurements — protégé (x-api-key)
router.post('/', deviceAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const { error } = validateMeasurement(body);
    if (error) throw error;
    if (!(await Location.findOne({ slug: String(body.locationSlug).toLowerCase() }))) throw errors.locationNotFound();
    const m = await Measurement.create({
      type: body.type,
      value: body.value,
      unit: body.unit,
      locationSlug: body.locationSlug,
      deviceId: body.deviceId || req.device._id,
      timestamp: new Date(body.timestamp),
    });
    success(res, 201, m.toJSON());
  } catch (e) { next(e); }
});

// POST /v1/measurements/batch — protégé. Réponse 207 (succès partiel possible).
router.post('/batch', deviceAuth, async (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) throw errors.validation('Le corps doit être un tableau de mesures.');
    const accepted = [];
    const rejected = [];
    for (let i = 0; i < req.body.length; i++) {
      const item = req.body[i];
      const { error } = validateMeasurement(item || {});
      if (error) { rejected.push({ index: i, code: error.code, details: error.details }); continue; }
      if (!(await Location.findOne({ slug: String(item.locationSlug).toLowerCase() }))) {
        rejected.push({ index: i, code: 'LOCATION_NOT_FOUND' });
        continue;
      }
      const m = await Measurement.create({
        type: item.type, value: item.value, unit: item.unit,
        locationSlug: item.locationSlug, deviceId: item.deviceId || req.device._id,
        timestamp: new Date(item.timestamp),
      });
      accepted.push(m.toJSON());
    }
    res.status(207).json({ status: 'success', data: { accepted, rejected }, meta: { generatedAt: new Date().toISOString(), total: req.body.length, acceptedCount: accepted.length, rejectedCount: rejected.length } });
  } catch (e) { next(e); }
});

// GET /v1/measurements — public, paginé/filtré
router.get('/', async (req, res, next) => {
  try {
    const filter = buildTimeWindow(req.query, 'timestamp');
    if (req.query.locationSlug) filter.locationSlug = String(req.query.locationSlug).toLowerCase();
    if (req.query.type) filter.type = req.query.type;
    const { page, perPage, skip, sort } = parsePagination(req.query, {
      maxPerPage: parseInt(process.env.MAX_PER_PAGE, 10) || 200,
      defaultSort: 'timestamp:desc',
      sortableFields: ['timestamp', 'value', 'receivedAt'],
    });
    const [items, total] = await Promise.all([
      Measurement.find(filter).sort(sort).skip(skip).limit(perPage),
      Measurement.countDocuments(filter),
    ]);
    success(res, 200, items.map((d) => d.toJSON()), paginationMeta(page, perPage, total));
  } catch (e) { next(e); }
});

module.exports = router;
