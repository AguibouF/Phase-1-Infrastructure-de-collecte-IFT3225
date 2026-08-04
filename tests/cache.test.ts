import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheControl, noCache } from '../src/middlewares/cache';
import cacheService from '../src/services/cacheService';

// Fabrique un faux objet Response minimal (setHeader/status/json) qui enregistre
// les en-têtes posés et le dernier corps sérialisé.
function makeRes(statusCode = 200) {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode,
    headers,
    setHeader: (k: string, v: string) => { headers[k] = v; },
    status: (code: number) => { res.statusCode = code; return res; },
    json: (body: unknown) => { res.body = body; return res; },
    body: undefined,
  };
  return res;
}

describe('cacheControl', () => {
  beforeEach(() => cacheService.flushAll());

  it('pose l’en-tête Cache-Control public', () => {
    const res = makeRes();
    cacheControl(30)({ method: 'GET', originalUrl: '/v1/x' } as any, res, () => {});
    expect(res.headers['Cache-Control']).toBe('public, max-age=30');
  });

  it('MISS puis HIT : la 2e requête est servie depuis le cache sans appeler next', () => {
    const url = '/v1/ambiance/cafe/now?window=30m';
    const payload = { status: 'success', data: { noise: 42 } };

    // 1re requête : cache vide → MISS, next() appelé, réponse mise en cache.
    const res1 = makeRes();
    const next1 = vi.fn();
    cacheControl(30)({ method: 'GET', originalUrl: url } as any, res1, next1);
    expect(res1.headers['X-Cache']).toBe('MISS');
    expect(next1).toHaveBeenCalledOnce();
    res1.json(payload); // le handler renvoie la réponse → stockage en cache

    // 2e requête : même URL → HIT, réponse servie sans next().
    const res2 = makeRes();
    const next2 = vi.fn();
    cacheControl(30)({ method: 'GET', originalUrl: url } as any, res2, next2);
    expect(res2.headers['X-Cache']).toBe('HIT');
    expect(next2).not.toHaveBeenCalled();
    expect(res2.body).toEqual(payload);
  });

  it('ne met pas en cache les réponses non-200 (erreurs)', () => {
    const url = '/v1/ambiance/inconnu/now';
    const res = makeRes();
    cacheControl(30)({ method: 'GET', originalUrl: url } as any, res, () => {});
    res.statusCode = 404;
    res.json({ status: 'error' });
    expect(cacheService.get(url)).toBeUndefined();
  });

  it('n’applique pas le cache mémoire aux méthodes d’écriture', () => {
    const res = makeRes();
    const next = vi.fn();
    cacheControl(30)({ method: 'POST', originalUrl: '/v1/measurements' } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers['X-Cache']).toBeUndefined();
  });
});

describe('noCache', () => {
  it('interdit toute mise en cache', () => {
    const res = makeRes();
    const next = vi.fn();
    noCache({} as any, res, next);
    expect(res.headers['Cache-Control']).toContain('no-store');
    expect(next).toHaveBeenCalledOnce();
  });
});
