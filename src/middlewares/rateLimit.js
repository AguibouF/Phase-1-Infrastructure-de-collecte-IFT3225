const rateLimit = require('express-rate-limit');
const { meta } = require('../utils/responses');

// 429 RATE_LIMIT : limite globale (130 req/min par défaut, cf. rapport).
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_MIN, 10) || 130,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      status: 'error',
      error: { code: 'RATE_LIMIT', message: 'Trop de requêtes : limite par minute atteinte.' },
      meta: meta(),
    }),
});

module.exports = limiter;
