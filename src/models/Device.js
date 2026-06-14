const crypto = require('crypto');
const mongoose = require('mongoose');

// Un appareil = une source de collecte identifiable, porteuse d'une clé API.
const deviceSchema = new mongoose.Schema(
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
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Device', deviceSchema);
