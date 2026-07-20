import mongoose, { Schema, HydratedDocument, Types } from 'mongoose';

// Donnée numérique brute produite par un capteur.
export interface IMeasurement {
  type: 'noise_level';
  value: number;
  unit: 'dB';
  locationSlug: string;
  deviceId: Types.ObjectId | null;
  timestamp: Date; // moment réel de la mesure (fourni par le client)
  receivedAt: Date; // moment de réception (serveur)
}

export type MeasurementDocument = HydratedDocument<IMeasurement>;

const measurementSchema = new Schema<IMeasurement>(
  {
    type: { type: String, required: true, enum: ['noise_level'] },
    value: { type: Number, required: true, min: 0, max: 140 },
    unit: { type: String, required: true, enum: ['dB'] },
    locationSlug: { type: String, required: true, trim: true, lowercase: true },
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', default: null },
    timestamp: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

measurementSchema.index({ locationSlug: 1, timestamp: -1 });

measurementSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

const Measurement = mongoose.model<IMeasurement>('Measurement', measurementSchema);
export default Measurement;
