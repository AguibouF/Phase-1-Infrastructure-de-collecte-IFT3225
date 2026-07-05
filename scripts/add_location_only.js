// Script temporaire pour créer uniquement le nouveau lieu Parc La Fontaine et son device
// Usage : node scripts/add_location_only.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Location = require('../src/models/Location');
const Device = require('../src/models/Device');

async function run() {
  await connectDB();
  console.log('Création du lieu Parc La Fontaine...');

  // Créer le 3ème lieu s'il n'existe pas
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
  console.log(`✓ Lieu créé : ${newLocation.displayName}`);

  // Créer un device pour ce nouveau lieu s'il n'existe pas
  const device = await Device.findOneAndUpdate(
    { name: `phyphox-${newLocation.slug}` },
    { 
      name: `phyphox-${newLocation.slug}`, 
      locationSlug: newLocation.slug, 
      lastSeenAt: new Date() 
    },
    { upsert: true, new: true }
  );
  console.log(`✓ Device créé : ${device.name} (apiKey=${device.apiKey})`);

  console.log('\nLieu et device créés avec succès !');
  await mongoose.connection.close();
}

run().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
