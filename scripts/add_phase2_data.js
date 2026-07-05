// Script pour la Phase 2 : ajoute 12 nouvelles mesures sur 3 lieux différents
// Usage : node scripts/add_phase2_data.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Location = require('../src/models/Location');
const Device = require('../src/models/Device');
const Measurement = require('../src/models/Measurement');
const Observation = require('../src/models/Observation');
const { DENSITY, VIBE, PROXIMITY } = require('../src/models/Observation');

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function run() {
  await connectDB();
  console.log('Ajout des données Phase 2...');

  // 1. Créer le 3ème lieu s'il n'existe pas
  const newLocation = await Location.findOneAndUpdate(
    { slug: 'parc-la-fontaine' },
    { 
      slug: 'parc-la-fontaine', 
      displayName: 'Parc La Fontaine', 
      city: 'montreal', 
      type: 'parc' 
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Lieu : ${newLocation.displayName}`);

  // 2. Créer un device pour ce nouveau lieu s'il n'existe pas
  const device = await Device.findOneAndUpdate(
    { name: `phyphox-${newLocation.slug}` },
    { 
      name: `phyphox-${newLocation.slug}`, 
      locationSlug: newLocation.slug, 
      lastSeenAt: new Date() 
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Device : ${device.name} (apiKey=${device.apiKey})`);

  // 3. Récupérer les devices pour les lieux existants
  const existingDevices = await Device.find({
    locationSlug: { $in: ['cafeteria-roger-gaudry', 'bibliotheque-edc'] }
  });
  console.log(`✓ ${existingDevices.length} devices existants trouvés`);

  // 4. Ajouter 4 nouvelles mesures par lieu (12 au total)
  const locations = ['cafeteria-roger-gaudry', 'bibliotheque-edc', 'parc-la-fontaine'];
  const measurements = [];
  const observations = [];
  const now = Date.now();

  for (const locSlug of locations) {
    // Trouver le device correspondant
    const locDevice = locSlug === 'parc-la-fontaine' 
      ? device 
      : existingDevices.find(d => d.locationSlug === locSlug);
    
    if (!locDevice) {
      console.log(`⚠ Pas de device trouvé pour ${locSlug}, skip...`);
      continue;
    }

    // Profil sonore selon le type de lieu
    let baseNoise = 50;
    if (locSlug === 'bibliotheque-edc') baseNoise = 42;
    if (locSlug === 'cafeteria-roger-gaudry') baseNoise = 58;
    if (locSlug === 'parc-la-fontaine') baseNoise = 45;

    // 4 mesures récentes (toutes les 30 min sur les 2 dernières heures)
    for (let i = 0; i < 4; i++) {
      const ts = new Date(now - i * 30 * 60e3);
      const hour = ts.getUTCHours();
      
      // Variation selon l'heure
      const hourVariation = Math.exp(-Math.pow(hour - 16, 2) / 8) * 15;
      const value = Math.min(140, Math.max(0, baseNoise + hourVariation + rand(-3, 3)));

      measurements.push({
        type: 'noise_level',
        value: Math.round(value * 10) / 10,
        unit: 'dB',
        locationSlug: locSlug,
        deviceId: locDevice._id,
        timestamp: ts,
      });

      // 1 observation par mesures
      const noisy = value > 60;
      observations.push({
        locationSlug: locSlug,
        density: noisy ? pick(['Fréquenté', 'Bondé']) : pick(['Vide', 'Modéré']),
        proximity: noisy ? pick(['Fréquenté', 'Serré']) : pick(['Isolé', 'Espacé']),
        vibe: noisy ? pick(['Sociable', 'Bruyante']) : pick(['Calme', 'Concentré']),
        notes: `Données Phase 2 - mesure ${i + 1}`,
        timestamp: ts,
      });
    }
  }

  await Measurement.insertMany(measurements);
  await Observation.insertMany(observations);
  console.log(`✓ ${measurements.length} nouvelles mesures ajoutées`);
  console.log(`✓ ${observations.length} nouvelles observations ajoutées`);
  console.log('\nDonnées Phase 2 ajoutées avec succès !');
  await mongoose.connection.close();
}

run().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
