import { describe, it, expect, beforeEach } from 'vitest';
import cacheService from '../src/services/cacheService';

// Tests unitaires du service de cache mémoire (node-cache), sans serveur ni DB.
describe('cacheService', () => {
  beforeEach(() => cacheService.flushAll());

  it('stocke et relit une valeur (set/get)', () => {
    cacheService.set('k1', { a: 1 });
    expect(cacheService.get('k1')).toEqual({ a: 1 });
  });

  it('renvoie undefined pour une clé absente', () => {
    expect(cacheService.get('inconnue')).toBeUndefined();
  });

  it('supprime une entrée précise (del)', () => {
    cacheService.set('k1', 1);
    cacheService.del('k1');
    expect(cacheService.get('k1')).toBeUndefined();
  });

  it('invalide par motif toutes les clés contenant le segment (delPattern)', () => {
    cacheService.set('/v1/ambiance/cafe/now', 1);
    cacheService.set('/v1/ambiance/bar/now', 2);
    cacheService.set('/v1/locations', 3);

    cacheService.delPattern('ambiance');

    expect(cacheService.get('/v1/ambiance/cafe/now')).toBeUndefined();
    expect(cacheService.get('/v1/ambiance/bar/now')).toBeUndefined();
    // Les clés sans le segment sont préservées.
    expect(cacheService.get('/v1/locations')).toBe(3);
  });

  it('expire une entrée après son TTL', async () => {
    cacheService.set('court', 1, 1); // TTL = 1 seconde (granularité node-cache)
    expect(cacheService.get('court')).toBe(1);
    await new Promise((r) => setTimeout(r, 1100));
    expect(cacheService.get('court')).toBeUndefined();
  });

  it('vide tout le cache (flushAll)', () => {
    cacheService.set('a', 1);
    cacheService.set('b', 2);
    cacheService.flushAll();
    expect(cacheService.get('a')).toBeUndefined();
    expect(cacheService.get('b')).toBeUndefined();
  });
});
