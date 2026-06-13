import mongoose from "mongoose";

/**
 * Modèle `Device` — appareil de collecte authentifié par clé API.
 * Champs conformes au guide d'intégration (auth par `apiKeyHash`).
 */
const deviceSchema = new mongoose.Schema({
  name: String,
  locationSlug: String,
  apiKeyHash: String, // SHA-256 de la clé en clair
  revokedAt: { type: Date, default: null },
  lastSeenAt: Date,
  createdAt: Date,
});

export default mongoose.model("Device", deviceSchema);
