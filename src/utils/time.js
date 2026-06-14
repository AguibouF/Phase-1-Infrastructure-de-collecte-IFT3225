const { errors } = require('./responses');

// Convertit "3h", "30m", "45s", "2d" en millisecondes.
function parseDuration(str) {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(String(str).trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[m[2]];
  return n * unit;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// Construit une fenêtre temporelle à partir de from/to OU last (mutuellement exclusifs).
function buildTimeWindow(query, field = 'timestamp') {
  const { from, to, last } = query;
  if (last && (from || to)) {
    throw errors.validation('Combiner "last" avec "from"/"to" est interdit (fenêtres contradictoires).', [
      { field: 'last', issue: 'conflict' },
    ]);
  }
  const filter = {};
  if (last) {
    const ms = parseDuration(last);
    if (ms === null) throw errors.validation('Paramètre "last" invalide (ex: 3h, 30m).', [{ field: 'last', issue: 'invalid' }]);
    filter[field] = { $gte: new Date(Date.now() - ms) };
    return filter;
  }
  if (from || to) {
    filter[field] = {};
    if (from) {
      const d = new Date(from);
      if (!isValidDate(d)) throw errors.validation('"from" doit être une date ISO 8601.', [{ field: 'from', issue: 'invalid' }]);
      filter[field].$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isValidDate(d)) throw errors.validation('"to" doit être une date ISO 8601.', [{ field: 'to', issue: 'invalid' }]);
      filter[field].$lte = d;
    }
  }
  return filter;
}

module.exports = { parseDuration, isValidDate, buildTimeWindow };
