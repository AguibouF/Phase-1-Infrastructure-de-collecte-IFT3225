// Script pour ajouter des coordonnées aux lieux existants
// Usage : node scripts/add_coordinates.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../dist/src/config/db');
const Location = require('../dist/src/models/Location').default;

async function run() {
  await connectDB();
  console.log('Ajout des coordonnées aux lieux...');

  // Coordonnées réelles pour Montréal
  const locationsWithCoords = [
    {
      slug: 'cafeteria-roger-gaudry',
      latitude: 45.5008,
      longitude: -73.6145,
    },
    {
      slug: 'bibliotheque-edc',
      latitude: 45.5045,
      longitude: -73.6132,
    },
    {
      slug: 'parc-la-fontaine',
      latitude: 45.5167,
      longitude: -73.5667,
    },
  ];

  for (const loc of locationsWithCoords) {
    const updated = await Location.findOneAndUpdate(
      { slug: loc.slug },
      { latitude: loc.latitude, longitude: loc.longitude },
      { new: true }
    );
    if (updated) {
      console.log(`✓ ${updated.displayName} : ${updated.latitude}, ${updated.longitude}`);
    } else {
      console.log(`⚠ Lieu non trouvé : ${loc.slug}`);
    }
  }

  console.log('\nCoordonnées ajoutées avec succès !');
  await mongoose.connection.close();
}

run().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
