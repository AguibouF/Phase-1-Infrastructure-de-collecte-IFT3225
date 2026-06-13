import mongoose from "mongoose";

/**
 * Modèle `Measurement` — mesure ponctuelle de niveau sonore.
 */
const measurementSchema = new mongoose.Schema({
  type: { type: String, enum: ["noise_level"] },
  value: Number, // 0-140
  unit: { type: String, enum: ["dB"] },
  locationSlug: String,
  timestamp: Date, // moment de la mesure (fourni par le client)
  receivedAt: Date, // moment de réception (serveur)
  deviceId: mongoose.Schema.Types.ObjectId, // optionnel
});

// Index composé essentiel à la performance des agrégations sémantiques.
measurementSchema.index({ locationSlug: 1, timestamp: -1 });

export default mongoose.model("Measurement", measurementSchema);
