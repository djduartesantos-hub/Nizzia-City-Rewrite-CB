const mongoose = require('mongoose')

const npcEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['npc_injured', 'npc_arrested', 'npc_released', 'npc_died', 'npc_moved', 'npc_action', 'npc_conflict'],
    required: true,
  },
  npcId: { type: mongoose.Schema.Types.ObjectId, ref: 'NPC', required: true },
  npcName: { type: String, required: true },
  cityId: { type: String, required: true },
  zoneId: { type: String, default: null },
  description: { type: String, required: true },
  publiclyVisible: { type: Boolean, default: true },
  involvedPlayers: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
})

npcEventSchema.index({ cityId: 1, timestamp: -1 })
npcEventSchema.index({ npcId: 1, timestamp: -1 })

module.exports = mongoose.model('NPCEvent', npcEventSchema)
