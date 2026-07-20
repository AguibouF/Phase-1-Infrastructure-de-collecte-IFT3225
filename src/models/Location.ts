import mongoose, { Schema, HydratedDocument } from 'mongoose';

// Un lieu est une entité stable, identifiée par un slug en kebab-case.
export interface ILocation {
  slug: string;
  displayName: string;
  city: string;
  type: string;
  latitude?: number; // Phase 2 : coordonnées optionnelles (rétrocompatibilité)
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type LocationDocument = HydratedDocument<ILocation>;

const locationSchema = new Schema<ILocation>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug doit être en kebab-case'],
    },
    displayName: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, lowercase: true },
    type: { type: String, required: true, trim: true, lowercase: true }, // cafeteria, bibliotheque, ...
    latitude: { type: Number, required: false, min: -90, max: 90 },
    longitude: { type: Number, required: false, min: -180, max: 180 },
  },
  { timestamps: true }
);

locationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

const Location = mongoose.model<ILocation>('Location', locationSchema);
export default Location;
