const { errors } = require('./responses');

// Lit page / perPage / sort et construit les options Mongo + le bloc meta.
function parsePagination(query, { maxPerPage = 200, defaultSort = 'timestamp:desc', sortableFields = [] } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let perPage = parseInt(query.perPage, 10) || 25;
  if (perPage < 1) perPage = 25;
  if (perPage > maxPerPage) perPage = maxPerPage;

  const sortRaw = query.sort || defaultSort;
  const [field, dir] = sortRaw.split(':');
  if (sortableFields.length && !sortableFields.includes(field)) {
    throw errors.validation(`Tri non supporté sur le champ "${field}".`, [
      { field: 'sort', issue: 'unsupported' },
    ]);
  }
  if (dir && !['asc', 'desc'].includes(dir)) {
    throw errors.validation('sort doit être au format champ:asc ou champ:desc.', [
      { field: 'sort', issue: 'invalid' },
    ]);
  }
  const sort = { [field]: dir === 'asc' ? 1 : -1 };
  return { page, perPage, skip: (page - 1) * perPage, sort };
}

function paginationMeta(page, perPage, total) {
  return { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

module.exports = { parsePagination, paginationMeta };
