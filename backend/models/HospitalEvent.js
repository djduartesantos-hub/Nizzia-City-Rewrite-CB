const mongoose = require('mongoose')

const hospitalEventSchema = new mongoose.Schema({
  type: { type: String, enum: ['treat', 'revive', 'triage', 'death'], required: true },
  actorUserId: { type: String, default: null },
  actorName: { type: String, default: null },
  targetUserId: { type: String, required: true },
  targetName: { type: String, required: true },
  success: { type: Boolean, default: true },
  summary: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  ts: { type: Date, default: Date.now },
})

module.exports = mongoose.model('HospitalEvent', hospitalEventSchema)
