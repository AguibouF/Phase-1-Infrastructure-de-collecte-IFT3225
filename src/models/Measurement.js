const mongoose = require('mongoose');

// Donnée numérique brute produite par un capteur.
const measurementSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ['noise_level'] },
    value: { type: Number, required: true, min: 0, max: 140 },
    unit: { type: String, required: true, enum: ['dB'] },
    locationSlug: { type: String, required: true, trim: true, lowercase: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
    timestamp: { type: Date, required: true }, // moment réel de la mesure (fourni par le client)
    receivedAt: { type: Date, default: Date.now }, // moment de réception (serveur)
  },
  { timestamps: false }
);

measurementSchema.index({ locationSlug: 1, timestamp: -1 });

measurementSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Measurement', measurementSchema);
