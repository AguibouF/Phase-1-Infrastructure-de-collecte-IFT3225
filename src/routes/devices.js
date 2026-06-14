const express = require('express');
const Device = require('../models/Device');
const Location = require('../models/Location');
const { success, errors } = require('../utils/responses');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { adminAuth } = require('../middlewares/auth');

const router = express.Router();

// POST /v1/devices
// ⚠️ FAILLE VOLONTAIRE (Phase 1) : cet endpoint n'est PAS protégé.
// N'importe qui peut créer un device et obtenir une clé API valide.
// Voir la section "Sécurité" du README pour la vulnérabilité et la solution proposée.
router.post('/', async (req, res, next) => {
  try {
    const { name, locationSlug } = req.body || {};
    const missing = [];
    if (!name) missing.push({ field: 'name', issue: 'missing' });
    if (!locationSlug) missing.push({ field: 'locationSlug', issue: 'missing' });
    if (missing.length) throw errors.validation('Champs requis manquants.', missing);
    const loc = await Location.findOne({ slug: String(locationSlug).toLowerCase() });
    if (!loc) throw errors.locationNotFound('locationSlug ne correspond à aucun lieu.');
    if (await Device.findOne({ name, locationSlug: String(locationSlug).toLowerCase() }))
      throw errors.conflict('DEVICE_EXISTS', 'Un appareil portant ce nom existe déjà pour ce lieu.');
    const device = await Device.create({ name, locationSlug });
    // La clé n'est renvoyée qu'à la création.
    success(res, 201, { id: device.id, name: device.name, locationSlug: device.locationSlug, apiKey: device.apiKey });
  } catch (e) { next(e); }
});

// GET /v1/devices — public (la clé API n'est jamais exposée ici)
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.locationSlug) filter.locationSlug = String(req.query.locationSlug).toLowerCase();
    const { page, perPage, skip, sort } = parsePagination(req.query, {
      defaultSort: 'createdAt:desc',
      sortableFields: ['name', 'locationSlug', 'lastSeenAt', 'createdAt'],
    });
    const [items, total] = await Promise.all([
      Device.find(filter).sort(sort).skip(skip).limit(perPage),
      Device.countDocuments(filter),
    ]);
    success(res, 200, items.map((d) => ({ id: d.id, name: d.name, locationSlug: d.locationSlug, lastSeenAt: d.lastSeenAt })), paginationMeta(page, perPage, total));
  } catch (e) { next(e); }
});

// DELETE /v1/devices/:id — gestion (clé admin) : révoque la clé et supprime l'appareil
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) throw errors.notFound('Appareil introuvable.');
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
