import mongoose from "mongoose";

/**
 * Modèle `Observation` — relevé qualitatif d'ambiance saisi par un humain.
 */
const observationSchema = new mongoose.Schema({
  locationSlug: String,
  density: { type: String, enum: ["Vide", "Modéré", "Fréquenté", "Bondé"] },
  proximity: String,
  vibe: {
    type: String,
    enum: ["Calme", "Concentré", "Sociable", "Bruyante", "Festive", "Tendue"],
  },
  notes: String,
  timestamp: Date,
  receivedAt: Date,
});

export default mongoose.model("Observation", observationSchema);
