import mongoose from "mongoose";

/**
 * Modèle `Location` — lieu surveillé, identifié par un slug unique en kebab-case.
 */
const locationSchema = new mongoose.Schema({
  slug: { type: String, unique: true }, // ex. "cafeteria-roger-gaudry"
  displayName: String,
  city: String,
  type: String, // ex. "cafeteria"
});

export default mongoose.model("Location", locationSchema);
