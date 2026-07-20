import express, { Express, ErrorRequestHandler } from 'express';
import cors from 'cors';
import morgan from 'morgan';

import rateLimiter from './middlewares/rateLimit';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';
import { meta } from './utils/responses';

import devices from './routes/devices';
import locations from './routes/locations';
import measurements from './routes/measurements';
import observations from './routes/observations';
import ambiance from './routes/ambiance';
import auth from './routes/auth';
import events from './routes/events';

export function createApp(): Express {
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
  app.use('/v1/events', events); // temps réel SSE (bonus Phase 2)

  // 400 si JSON malformé (capté avant le 404)
  const jsonParseHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'Corps JSON invalide.' }, meta: meta() });
      return;
    }
    next(err);
  };
  app.use(jsonParseHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
