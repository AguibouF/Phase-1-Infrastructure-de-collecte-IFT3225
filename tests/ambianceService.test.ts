import { describe, it, expect } from 'vitest';
import {
  getNowPortrait,
  getQuietHours,
  getHistorySeries,
  rankByAmbiance,
  type NowPortrait,
} from '../src/services/ambianceService';
import { ambianceLabel } from '../src/utils/ambiance';

// Fabriques de données factices (pas de Mongoose : objets simples conformes aux
// interfaces *Like du domaine).
const noise = (value: number, timestamp = new Date('2026-07-20T12:00:00Z')) => ({
  type: 'noise_level',
  value,
  timestamp,
});
const obs = (density: string, proximity: string, vibe: string) => ({ density, proximity, vibe });

describe('ambianceLabel', () => {
  it('classe le silence comme calme', () => {
    expect(ambianceLabel(40)).toBe('calme');
  });
  it('classe un niveau intermédiaire comme modéré puis animé', () => {
    expect(ambianceLabel(60)).toBe('modéré');
    expect(ambianceLabel(70)).toBe('animé');
  });
  it('classe un fort niveau comme bruyant et l’absence de mesure comme inconnu', () => {
    expect(ambianceLabel(80)).toBe('bruyant');
    expect(ambianceLabel(null)).toBe('inconnu');
  });
});

describe('getNowPortrait', () => {
  it('moyenne le bruit et déduit l’étiquette d’ambiance', () => {
    const p = getNowPortrait('cafe', [noise(48), noise(52)], [], '30m');
    expect(p.score.noise).toBe(50);
    expect(p.ambianceLabel).toBe('modéré');
    expect(p.sampleSize.measurements).toBe(2);
  });

  it('renvoie « inconnu » quand la fenêtre est vide', () => {
    const p = getNowPortrait('cafe', [], [], '30m');
    expect(p.score.noise).toBeNull();
    expect(p.ambianceLabel).toBe('inconnu');
  });

  it('déduit l’occupation et le mode des observations', () => {
    const p = getNowPortrait(
      'cafe',
      [noise(45)],
      [obs('Bondé', 'Serré', 'Festive'), obs('Bondé', 'Serré', 'Calme')],
      '30m'
    );
    expect(p.score.occupancy).toBe(95); // DENSITY_SCORE.Bondé
    expect(p.score.proximity).toBe('Serré'); // mode
    expect(p.sampleSize.observations).toBe(2);
  });
});

describe('getQuietHours', () => {
  it('ne garde que les créneaux sous le seuil', () => {
    // Créneaux distincts : deux mesures calmes (bucket 12:00) et une bruyante
    // (bucket 13:00). Seul le premier créneau doit être conservé.
    const calme = new Date('2026-07-20T12:00:00Z');
    const bruyant = new Date('2026-07-20T13:00:00Z');
    const slots = getQuietHours([noise(40, calme), noise(42, calme), noise(90, bruyant)], {
      thresholdDb: 55,
      days: 7,
      dayOfWeek: null,
    });
    expect(slots.every((s) => s.avgNoise <= 55)).toBe(true);
    expect(slots.length).toBe(1);
    expect(slots[0].avgNoise).toBe(41);
  });

  it('renvoie une liste vide quand tout dépasse le seuil', () => {
    const slots = getQuietHours([noise(80), noise(85)], { thresholdDb: 55, days: 7, dayOfWeek: null });
    expect(slots).toEqual([]);
  });

  it('filtre par jour de la semaine local (Montréal)', () => {
    // 2026-07-20 est un lundi (dow=1) à Montréal.
    const lundi = new Date('2026-07-20T16:00:00Z');
    const slots = getQuietHours([noise(40, lundi)], { thresholdDb: 55, days: 7, dayOfWeek: 1 });
    expect(slots.length).toBe(1);
    const aucun = getQuietHours([noise(40, lundi)], { thresholdDb: 55, days: 7, dayOfWeek: 3 });
    expect(aucun).toEqual([]);
  });
});

describe('getHistorySeries', () => {
  it('agrège les mesures par tranche (bucket)', () => {
    const t0 = new Date('2026-07-20T12:00:00Z');
    const t1 = new Date('2026-07-20T12:20:00Z'); // même bucket 30 min
    const series = getHistorySeries([noise(50, t0), noise(60, t1)], 30 * 60 * 1000);
    expect(series.length).toBe(1);
    expect(series[0].avgNoise).toBe(55);
    expect(series[0].samples).toBe(2);
  });

  it('sépare deux tranches distinctes et les trie', () => {
    const t0 = new Date('2026-07-20T12:00:00Z');
    const t2 = new Date('2026-07-20T13:00:00Z');
    const series = getHistorySeries([noise(60, t2), noise(40, t0)], 30 * 60 * 1000);
    expect(series.length).toBe(2);
    expect(series[0].avgNoise).toBe(40); // trié chronologiquement
    expect(series[1].avgNoise).toBe(60);
  });

  it('renvoie une série vide sans mesure', () => {
    expect(getHistorySeries([], 30 * 60 * 1000)).toEqual([]);
  });
});

describe('rankByAmbiance', () => {
  const portrait = (location: string, noiseVal: number | null): NowPortrait => ({
    location,
    generatedAt: new Date().toISOString(),
    window: '30m',
    sampleSize: { measurements: noiseVal == null ? 0 : 3, observations: 0 },
    score: { noise: noiseVal, occupancy: null, vibe: null, proximity: null },
    ambianceLabel: ambianceLabel(noiseVal),
  });

  it('classe du plus calme au plus animé', () => {
    const r = rankByAmbiance([portrait('bar', 75), portrait('biblio', 40), portrait('cafe', 58)]);
    expect(r.ranked.map((p) => p.location)).toEqual(['biblio', 'cafe', 'bar']);
    expect(r.quietest).toBe('biblio');
    expect(r.busiest).toBe('bar');
  });

  it('écarte du classement les lieux sans mesure', () => {
    const r = rankByAmbiance([portrait('bar', 70), portrait('fantome', null)]);
    expect(r.ranked.map((p) => p.location)).toEqual(['bar']);
    expect(r.unknown.map((p) => p.location)).toEqual(['fantome']);
  });

  it('renvoie quietest/busiest à null quand rien n’est mesurable', () => {
    const r = rankByAmbiance([portrait('a', null), portrait('b', null)]);
    expect(r.quietest).toBeNull();
    expect(r.busiest).toBeNull();
    expect(r.ranked).toEqual([]);
  });
});
