const express = require('express');
const Location = require('../models/Location');
const { success, errors } = require('../utils/responses');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { adminAuth } = require('../middlewares/auth');

const router = express.Router();

// GET /v1/locations — public
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.city) filter.city = String(req.query.city).toLowerCase();
    if (req.query.type) filter.type = String(req.query.type).toLowerCase();
    const { page, perPage, skip, sort } = parsePagination(req.query, {
      maxPerPage: parseInt(process.env.MAX_PER_PAGE, 10) || 200,
      defaultSort: 'slug:asc',
      sortableFields: ['slug', 'displayName', 'city', 'type', 'createdAt'],
    });
    const [items, total] = await Promise.all([
      Location.find(filter).sort(sort).skip(skip).limit(perPage),
      Location.countDocuments(filter),
    ]);
    success(res, 200, items.map((d) => ({ slug: d.slug, displayName: d.displayName, city: d.city, type: d.type })), paginationMeta(page, perPage, total));
  } catch (e) { next(e); }
});

// POST /v1/locations — gestion (clé admin)
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const { slug, displayName, city, type } = req.body || {};
    const missing = [];
    for (const [k, v] of Object.entries({ slug, displayName, city, type })) if (!v) missing.push({ field: k, issue: 'missing' });
    if (missing.length) throw errors.validation('Champs requis manquants.', missing);
    if (await Location.findOne({ slug: String(slug).toLowerCase() })) throw errors.conflict('LOCATION_EXISTS', 'Un lieu avec ce slug existe déjà.');
    const loc = await Location.create({ slug, displayName, city, type });
    success(res, 201, loc.toJSON());
  } catch (e) { next(e); }
});

// PUT /v1/locations/:slug — gestion (clé admin)
router.put('/:slug', adminAuth, async (req, res, next) => {
  try {
    const loc = await Location.findOne({ slug: String(req.params.slug).toLowerCase() });
    if (!loc) throw errors.locationNotFound();
    const { displayName, city, type } = req.body || {};
    if (displayName !== undefined) loc.displayName = displayName;
    if (city !== undefined) loc.city = city;
    if (type !== undefined) loc.type = type;
    await loc.save();
    success(res, 200, loc.toJSON());
  } catch (e) { next(e); }
});

module.exports = router;
