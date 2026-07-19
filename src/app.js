const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const rateLimiter = require('./middlewares/rateLimit');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { meta } = require('./utils/responses');

const devices = require('./routes/devices');
const locations = require('./routes/locations');
const measurements = require('./routes/measurements');
const observations = require('./routes/observations');
const ambiance = require('./routes/ambiance');
const auth = require('./routes/auth');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json()); // parse le corps JSON des requêtes
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(rateLimiter);

  // Santé / racine
  app.get('/', (_req, res) => res.json({ status: 'success', data: { name: 'ambiance-collecte', version: 'v1' }, meta: meta() }));
  app.get('/v1/health', (_req, res) => res.json({ status: 'success', data: { ok: true }, meta: meta() }));

  // Ressources
  app.use('/v1/devices', devices);
  app.use('/v1/locations', locations);
  app.use('/v1/measurements', measurements);
  app.use('/v1/observations', observations);
  app.use('/v1/ambiance', ambiance);
  app.use('/v1/auth', auth);

  // 400 si JSON malformé (capté avant le 404)
  app.use((err, _req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'Corps JSON invalide.' }, meta: meta() });
    }
    next(err);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
