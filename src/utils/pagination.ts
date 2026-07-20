import { errors } from './responses';

export interface PaginationOptions {
  maxPerPage?: number;
  defaultSort?: string;
  sortableFields?: string[];
}

export interface PaginationResult {
  page: number;
  perPage: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

type QueryLike = Record<string, unknown>;

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// Lit page / perPage / sort et construit les options Mongo + le bloc meta.
export function parsePagination(
  query: QueryLike,
  { maxPerPage = 200, defaultSort = 'timestamp:desc', sortableFields = [] }: PaginationOptions = {}
): PaginationResult {
  const page = Math.max(1, parseInt(asString(query.page) ?? '', 10) || 1);
  let perPage = parseInt(asString(query.perPage) ?? '', 10) || 25;
  if (perPage < 1) perPage = 25;
  if (perPage > maxPerPage) perPage = maxPerPage;

  const sortRaw = asString(query.sort) || defaultSort;
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
  const sort: Record<string, 1 | -1> = { [field]: dir === 'asc' ? 1 : -1 };
  return { page, perPage, skip: (page - 1) * perPage, sort };
}

export function paginationMeta(page: number, perPage: number, total: number) {
  return { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}
