const mongoose = require('mongoose');

const PrisonEventSchema = new mongoose.Schema({
  type: { type: String, enum: ['breakout', 'bail', 'attempt', 'system'], default: 'system' },
  actorUserId: { type: String },
  actorName: { type: String },
  targetUserId: { type: String, required: true },
  targetName: { type: String },
  success: { type: Boolean, default: false },
  summary: { type: String, required: true },
  meta: { type: Object },
}, {
  timestamps: { createdAt: 'ts', updatedAt: false },
});

module.exports = mongoose.model('PrisonEvent', PrisonEventSchema);
