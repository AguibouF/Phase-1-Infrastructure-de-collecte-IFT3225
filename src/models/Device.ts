import crypto from 'crypto';
import mongoose, { Schema, HydratedDocument } from 'mongoose';

// Un appareil = une source de collecte identifiable, porteuse d'une clé API.
export interface IDevice {
  name: string;
  locationSlug: string;
  apiKey: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DeviceDocument = HydratedDocument<IDevice>;

const deviceSchema = new Schema<IDevice>(
  {
    name: { type: String, required: true, trim: true },
    locationSlug: { type: String, required: true, trim: true, lowercase: true },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      default: () => 'dev_' + crypto.randomBytes(24).toString('hex'),
    },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Un même nom d'appareil ne peut pas être dupliqué dans un même lieu (409 DEVICE_EXISTS).
deviceSchema.index({ name: 1, locationSlug: 1 }, { unique: true });

deviceSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

const Device = mongoose.model<IDevice>('Device', deviceSchema);
export default Device;
