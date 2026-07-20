import mongoose, { Schema, HydratedDocument, Types } from 'mongoose';

// Vocabulaires contrôlés (validés par l'API, réutilisés par le client).
export const DENSITY = ['Vide', 'Modéré', 'Fréquenté', 'Bondé'] as const;
export const VIBE = ['Calme', 'Concentré', 'Sociable', 'Bruyante', 'Festive', 'Tendue'] as const;
export const PROXIMITY = ['Isolé', 'Espacé', 'Fréquenté', 'Serré'] as const;

export type Density = (typeof DENSITY)[number];
export type Vibe = (typeof VIBE)[number];
export type Proximity = (typeof PROXIMITY)[number];

// Donnée humaine qualitative.
export interface IObservation {
  locationSlug: string;
  density: Density;
  proximity: Proximity;
  vibe: Vibe;
  notes: string;
  timestamp: Date;
  receivedAt: Date;
  author?: Types.ObjectId; // Phase 2 : lien vers l'auteur (optionnel, rétrocompatible)
}

export type ObservationDocument = HydratedDocument<IObservation>;

const observationSchema = new Schema<IObservation>(
  {
    locationSlug: { type: String, required: true, trim: true, lowercase: true },
    density: { type: String, required: true, enum: DENSITY },
    proximity: { type: String, required: true, enum: PROXIMITY },
    vibe: { type: String, required: true, enum: VIBE },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    timestamp: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: false }
);

observationSchema.index({ locationSlug: 1, timestamp: -1 });

observationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

const Observation = mongoose.model<IObservation>('Observation', observationSchema);
export default Observation;
