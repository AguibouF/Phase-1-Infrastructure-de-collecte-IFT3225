const mongoose = require('mongoose');

// Un lieu est une entité stable, identifiée par un slug en kebab-case.
const locationSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

locationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Location', locationSchema);
