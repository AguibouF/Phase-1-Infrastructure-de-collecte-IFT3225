// Peuple la base avec des données de démonstration : lieux, devices, mesures, observations.
// Permet de tester les endpoints de consultation et sémantiques SANS faire une collecte réelle.
//   Usage : npm run seed
require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
  { slug: 'parc-la-fontaine', displayName: 'Parc La Fontaine', city: 'montreal', type: 'parc', latitude: 45.5167, longitude: -73.5667 },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Profil sonore selon l'heure (UTC) : plus bruyant le midi.
function noiseForHour(h, base) {
  const peak = Math.exp(-Math.pow(h - 16, 2) / 8) * 25; // pic vers 12h heure locale (~16h UTC)
  return Math.min(140, Math.max(0, base + peak + rand(-4, 4)));
}

// Après le seed, aligne DEVICE_API_KEY du .env sur le device du LOCATION_SLUG configuré :
// plus besoin de copier-coller la clé à chaque seed.
function syncEnvDeviceKey(devices) {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  let env = fs.readFileSync(envPath, 'utf8');
  const slugMatch = env.match(/^LOCATION_SLUG=(.+)$/m);
  const slug = slugMatch ? slugMatch[1].trim() : LOCATIONS[0].slug;
  const dev = devices.find((d) => d.locationSlug === slug);
  if (!dev) return;
  if (/^DEVICE_API_KEY=/m.test(env)) {
    env = env.replace(/^DEVICE_API_KEY=.*$/m, `DEVICE_API_KEY=${dev.apiKey}`);
  } else {
    env = env.trimEnd() + `\nDEVICE_API_KEY=${dev.apiKey}\n`;
  }
  fs.writeFileSync(envPath, env);
  console.log(`✓ DEVICE_API_KEY synchronisée dans .env (${dev.name})`);
}

async function run() {
  await connectDB();
  // On ne régénère que les données de démo des lieux du seed : les lieux, devices
  // (et donc leurs clés API) et les données des autres lieux sont conservés.
  const slugs = LOCATIONS.map((l) => l.slug);
  console.log('Nettoyage des mesures/observations de démo...');
  // Ne supprime que les données SIMULÉES : leur timestamp est antidaté par rapport
  // à receivedAt (insertion en batch), alors qu'une collecte réelle (bridge, client)
  // a receivedAt ≈ timestamp. Les collectes réelles sont donc conservées.
  const isSimulated = {
    locationSlug: { $in: slugs },
    $expr: { $gt: [{ $abs: { $subtract: ['$receivedAt', '$timestamp'] } }, 60e3] },
  };
  await Promise.all([
    Measurement.deleteMany(isSimulated),
    Observation.deleteMany(isSimulated),
  ]);

  const locs = [];
  for (const l of LOCATIONS) {
    locs.push(await Location.findOneAndUpdate({ slug: l.slug }, l, { upsert: true, new: true, setDefaultsOnInsert: true }));
  }
  console.log(`✓ ${locs.length} lieux`);

  const devices = [];
  for (const loc of locs) {
    const d = await Device.findOneAndUpdate(
      { name: `phyphox-${loc.slug}`, locationSlug: loc.slug },
      { lastSeenAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    devices.push(d);
    console.log(`✓ device ${d.name}  apiKey=${d.apiKey}`);
  }
  syncEnvDeviceKey(devices);

  const measurements = [];
  const observations = [];
  // Décalage de 2 min pour que même le point simulé le plus récent reste
  // distinguable d'une collecte réelle (cf. filtre isSimulated ci-dessus).
  const now = Date.now() - 2 * 60e3;
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
