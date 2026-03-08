const mongoose = require('mongoose')

const ObjectId = mongoose.Schema.Types.ObjectId

const scheduleEntrySchema = new mongoose.Schema({
  time: { type: String, required: true },
  location: { type: String, required: true },
  locationId: { type: String, required: true },
  action: {
    type: String,
    enum: ['walk', 'work', 'eat', 'drink', 'sleep', 'deal', 'patrol', 'train', 'gamble'],
    required: true,
  },
  label: { type: String, required: true },
})

const visitorLogSchema = new mongoose.Schema({
  visitorId: { type: ObjectId, required: true },
  visitorType: { type: String, enum: ['player', 'npc'], required: true },
  timestamp: { type: Date, default: Date.now },
  action: { type: String, enum: ['visit', 'sabotage', 'help', 'pay'], default: 'visit' },
})

const hospitalVisitorSchema = visitorLogSchema.clone()
const prisonVisitorSchema = new mongoose.Schema({
  visitorId: { type: ObjectId, required: true },
  visitorType: { type: String, enum: ['player', 'npc'], required: true },
  timestamp: { type: Date, default: Date.now },
})

const playerInteractionSchema = new mongoose.Schema({
  playerId: { type: ObjectId, required: true },
  playerName: { type: String, default: null },
  type: {
    type: String,
    enum: ['robbed', 'helped', 'attacked', 'paid', 'talked', 'arrested', 'released', 'betrayed', 'saved'],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  sentiment: { type: Number, min: -100, max: 100, default: 0 },
  notes: { type: String, default: null },
})

const npcInteractionSchema = new mongoose.Schema({
  npcId: { type: ObjectId, required: true },
  type: { type: String, enum: ['allied', 'fought', 'traded', 'betrayed'], required: true },
  timestamp: { type: Date, default: Date.now },
})

const actionLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  location: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  publiclyVisible: { type: Boolean, default: false },
})

const npcSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['character', 'ambient', 'vendor', 'guard', 'criminal', 'medic', 'detective'],
    required: true,
  },
  tier: { type: String, enum: ['1', '2', '3'], required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  age: { type: Number, min: 0, max: 120, required: true },
  avatar: { type: String, default: null },

  status: {
    alive: { type: Boolean, default: true },
    location: {
      type: String,
      enum: ['hospital', 'prison', 'street', 'building', 'bar', 'home', 'shelter', 'casino', 'gym', 'school', 'dead'],
      default: 'street',
    },
    locationId: { type: String, default: null },
    cityId: { type: String, required: true },
    condition: {
      type: String,
      enum: ['healthy', 'injured', 'recovering', 'arrested', 'dead', 'wanted', 'hiding'],
      default: 'healthy',
    },
    lastSeen: { type: Date, default: Date.now },
  },

  stats: {
    health: { type: Number, min: 0, max: 100, default: 100 },
    maxHealth: { type: Number, min: 80, max: 120, default: 100 },
    mentalHealth: { type: Number, min: 0, max: 100, default: 100 },
    strength: { type: Number, min: 1, max: 100, default: 10 },
    agility: { type: Number, min: 1, max: 100, default: 10 },
    intelligence: { type: Number, min: 1, max: 100, default: 10 },
  },

  personality: {
    aggression: { type: Number, min: 0, max: 100, default: 50 },
    loyalty: { type: Number, min: 0, max: 100, default: 50 },
    greed: { type: Number, min: 0, max: 100, default: 50 },
    corruptibility: { type: Number, min: 0, max: 100, default: 50 },
    ethics: { type: Number, min: 0, max: 100, default: 50 },
  },

  faction: {
    id: { type: String, default: null },
    name: { type: String, default: null },
    rank: { type: String, default: null },
    loyalty: { type: Number, default: 0 },
  },

  routine: {
    enabled: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    suspendReason: { type: String, default: null },
    schedule: { type: [scheduleEntrySchema], default: [] },
  },

  memory: {
    playerInteractions: { type: [playerInteractionSchema], default: [] },
    npcInteractions: { type: [npcInteractionSchema], default: [] },
    knownEvents: { type: [String], default: [] },
  },

  relationships: {
    allies: { type: [ObjectId], default: [] },
    enemies: { type: [ObjectId], default: [] },
    neutral: { type: [ObjectId], default: [] },
  },

  hospitalStay: {
    admittedAt: { type: Date, default: null },
    expectedDischarge: { type: Date, default: null },
    severity: { type: String, enum: ['light', 'moderate', 'critical'], default: null },
    cause: { type: String, default: null },
    treatedBy: { type: String, default: null },
    sabotaged: { type: Boolean, default: false },
    visitorLog: { type: [hospitalVisitorSchema], default: [] },
  },

  prisonStay: {
    arrestedAt: { type: Date, default: null },
    expectedRelease: { type: Date, default: null },
    sentence: { type: Number, default: null },
    crime: { type: String, default: null },
    cell: { type: String, default: null },
    behavior: { type: String, enum: ['good', 'neutral', 'bad'], default: 'neutral' },
    escapeAttempts: { type: Number, default: 0 },
    visitorLog: { type: [prisonVisitorSchema], default: [] },
  },

  activity: {
    lastAction: { type: String, default: null },
    lastActionAt: { type: Date, default: null },
    currentEvent: { type: String, default: null },
    actionLog: { type: [actionLogSchema], default: [] },
  },

  economy: {
    cash: { type: Number, default: 0 },
    debt: { type: Number, default: 0 },
    debtTo: { type: String, default: null },
  },

  meta: {
    seed: { type: Number, default: null },
    cityId: { type: String, required: true },
    generatedBy: { type: String, enum: ['seed', 'manual', 'event'], default: 'manual' },
    isPublic: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
})

npcSchema.index({ 'meta.cityId': 1 })
npcSchema.index({ tier: 1 })
npcSchema.index({ 'status.location': 1 })
npcSchema.index({ 'status.condition': 1 })

module.exports = mongoose.model('NPC', npcSchema)
