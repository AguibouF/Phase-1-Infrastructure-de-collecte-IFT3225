const mongoose = require('mongoose');

const DENSITY = ['Vide', 'Modéré', 'Fréquenté', 'Bondé'];
const VIBE = ['Calme', 'Concentré', 'Sociable', 'Bruyante', 'Festive', 'Tendue'];
const PROXIMITY = ['Isolé', 'Espacé', 'Fréquenté', 'Serré'];

// Donnée humaine qualitative.
const observationSchema = new mongoose.Schema(
  {
    locationSlug: { type: String, required: true, trim: true, lowercase: true },
    density: { type: String, required: true, enum: DENSITY },
    proximity: { type: String, required: true, enum: PROXIMITY },
    vibe: { type: String, required: true, enum: VIBE },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    timestamp: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: false }
);

observationSchema.index({ locationSlug: 1, timestamp: -1 });

observationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Observation', observationSchema);
module.exports.DENSITY = DENSITY;
module.exports.VIBE = VIBE;
module.exports.PROXIMITY = PROXIMITY;
