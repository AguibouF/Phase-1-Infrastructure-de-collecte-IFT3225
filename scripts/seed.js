// Peuple la base avec des données de démonstration : lieux, devices, mesures, observations.
// Permet de tester les endpoints de consultation et sémantiques SANS faire une collecte réelle.
//   Usage : npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../dist/src/config/db');
const Location = require('../dist/src/models/Location').default;
const Device = require('../dist/src/models/Device').default;
const Measurement = require('../dist/src/models/Measurement').default;
const Observation = require('../dist/src/models/Observation').default;
const { DENSITY, VIBE, PROXIMITY } = require('../dist/src/models/Observation');

const LOCATIONS = [
  { slug: 'cafeteria-roger-gaudry', displayName: 'Cafétéria Roger-Gaudry', city: 'montreal', type: 'cafeteria', latitude: 45.5008, longitude: -73.6145 },
  { slug: 'bibliotheque-edc', displayName: 'Bibliothèque EDC', city: 'montreal', type: 'bibliotheque', latitude: 45.5045, longitude: -73.6132 },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Profil sonore selon l'heure (UTC) : plus bruyant le midi.
function noiseForHour(h, base) {
  const peak = Math.exp(-Math.pow(h - 16, 2) / 8) * 25; // pic vers 12h heure locale (~16h UTC)
  return Math.min(140, Math.max(0, base + peak + rand(-4, 4)));
}

async function run() {
  await connectDB();
  console.log('Nettoyage des collections...');
  await Promise.all([Location.deleteMany({}), Device.deleteMany({}), Measurement.deleteMany({}), Observation.deleteMany({})]);

  const locs = await Location.insertMany(LOCATIONS);
  console.log(`✓ ${locs.length} lieux`);

  const devices = [];
  for (const loc of locs) {
    const d = await Device.create({ name: `phyphox-${loc.slug}`, locationSlug: loc.slug, lastSeenAt: new Date() });
    devices.push(d);
    console.log(`✓ device ${d.name}  apiKey=${d.apiKey}`);
  }

  const measurements = [];
  const observations = [];
  const now = Date.now();
  const DAYS_BACK = 14;

  for (const loc of locs) {
    const base = loc.type === 'bibliotheque' ? 42 : 58; // la biblio est plus calme
    for (let d = 0; d < DAYS_BACK; d++) {
      for (let h = 7; h <= 21; h++) {
        // 4 mesures par heure (toutes les 15 min)
        for (let q = 0; q < 4; q++) {
          const ts = new Date(now - d * 86400e3 - (21 - h) * 3600e3 - q * 15 * 60e3);
          measurements.push({
            type: 'noise_level',
            value: Math.round(noiseForHour(ts.getUTCHours(), base) * 10) / 10,
            unit: 'dB',
            locationSlug: loc.slug,
            deviceId: devices.find((x) => x.locationSlug === loc.slug)._id,
            timestamp: ts,
          });
        }
        // 1 observation par heure
        const obsTs = new Date(now - d * 86400e3 - (21 - h) * 3600e3);
        const noisy = noiseForHour(obsTs.getUTCHours(), base) > 65;
        observations.push({
          locationSlug: loc.slug,
          density: noisy ? pick(['Fréquenté', 'Bondé']) : pick(['Vide', 'Modéré']),
          proximity: noisy ? pick(['Fréquenté', 'Serré']) : pick(['Isolé', 'Espacé']),
          vibe: noisy ? pick(['Sociable', 'Bruyante', 'Festive']) : pick(['Calme', 'Concentré']),
          notes: '',
          timestamp: obsTs,
        });
      }
    }
  }

  await Measurement.insertMany(measurements);
  await Observation.insertMany(observations);
  console.log(`✓ ${measurements.length} mesures, ${observations.length} observations`);
  console.log('\nSeed terminé. Clés API ci-dessus pour tester les POST avec x-api-key.');
  await mongoose.connection.close();
}

run().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
