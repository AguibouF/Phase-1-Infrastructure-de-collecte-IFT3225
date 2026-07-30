import { describe, it, expect } from 'vitest';
import { parseDuration, isValidDate, buildTimeWindow } from '../src/utils/time';
import { ApiError } from '../src/utils/responses';

describe('parseDuration', () => {
  it('convertit les unités s/m/h/d en millisecondes', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('15m')).toBe(15 * 60_000);
    expect(parseDuration('2h')).toBe(2 * 3_600_000);
    expect(parseDuration('1d')).toBe(86_400_000);
  });

  it('renvoie null pour une entrée invalide', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('10x')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});

describe('isValidDate', () => {
  it('reconnaît une date valide et rejette le reste', () => {
    expect(isValidDate(new Date('2026-07-20'))).toBe(true);
    expect(isValidDate(new Date('pas une date'))).toBe(false);
    expect(isValidDate('2026-07-20')).toBe(false);
  });
});

describe('buildTimeWindow', () => {
  it('construit une fenêtre à partir de "last"', () => {
    const f = buildTimeWindow({ last: '1h' });
    expect(f.timestamp.$gte).toBeInstanceOf(Date);
    expect(f.timestamp.$lte).toBeUndefined();
  });

  it('construit une fenêtre from/to', () => {
    const f = buildTimeWindow({ from: '2026-07-01', to: '2026-07-02' });
    expect(f.timestamp.$gte).toBeInstanceOf(Date);
    expect(f.timestamp.$lte).toBeInstanceOf(Date);
  });

  it('rejette la combinaison last + from/to (fenêtres contradictoires)', () => {
    expect(() => buildTimeWindow({ last: '1h', from: '2026-07-01' })).toThrow(ApiError);
  });

  it('rejette une date invalide', () => {
    expect(() => buildTimeWindow({ from: 'pas-une-date' })).toThrow(ApiError);
  });
});
