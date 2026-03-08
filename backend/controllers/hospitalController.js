const Player = require('../models/Player')
const HospitalEvent = require('../models/HospitalEvent')
const { getConfig } = require('../services/worldConfigService')

async function ensureAuthPlayer(req) {
  const userId = req.authUserId
  if (!userId) throw new Error('Unauthorized')
  const player = await Player.findOne({ user: userId })
  if (!player) throw new Error('Player not found')
  return player
}

async function loadHospitalConfig() {
  return getConfig('hospital')
}

function calcReviveCost(player, config) {
  const cfg = config || {}
  const base = Number(cfg.reviveBase) || 0
  const blockSeconds = Math.max(60, Number(cfg.reviveBlockSeconds) || 300)
  const perBlock = Number(cfg.revivePerBlock) || 0
  const levelFactor = Number(cfg.reviveLevelFactor) || 0
  const seconds = Math.max(Number(cfg.minHospitalSeconds) || 0, Number(player.hospitalTime) || 0)
  const blocks = Math.max(1, Math.ceil(seconds / blockSeconds))
  const level = Math.max(1, Number(player.level) || 1)
  return Math.round(base + perBlock * blocks + levelFactor * level)
}

function mapPatient(doc, historyMap, config) {
  const userId = String(doc.user)
  return {
    userId,
    name: doc.name,
    id: doc.id,
    level: doc.level,
    remainingSeconds: Math.max(0, Number(doc.hospitalTime) || 0),
    health: doc.health,
    gang: doc.affiliation?.gang || null,
    cause: doc.lastDamage?.source || 'Grave ferimento',
    lastDamageAt: doc.lastDamage?.ts || null,
    reviveCost: calcReviveCost(doc, config),
    history: historyMap[userId] || [],
  }
}

async function listPatients(req, res) {
  try {
    const config = await loadHospitalConfig()
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20))
    const sort = String(req.query.sort || 'time_desc')
    const search = String(req.query.q || '').trim()
    const gang = String(req.query.gang || 'all').trim()
    const filter = { hospitalized: true }
    if (search) {
      const regex = new RegExp(search, 'i')
      filter.$or = [{ name: regex }, { id: Number(search) || -1 }]
    }
    if (gang && gang !== 'all') {
      filter['affiliation.gang'] = gang
    }

    const sortMap = {
      time_desc: { hospitalTime: -1 },
      time_asc: { hospitalTime: 1 },
      level_desc: { level: -1 },
      level_asc: { level: 1 },
      health_asc: { health: 1 },
    }
    const sortStage = sortMap[sort] || sortMap.time_desc

    const total = await Player.countDocuments(filter)
    const docs = await Player.find(filter)
      .sort(sortStage)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('user name id level hospitalTime health affiliation lastDamage')

    const userIds = docs.map((d) => String(d.user))
    const historyMap = {}
    if (userIds.length) {
      const events = await HospitalEvent.find({ targetUserId: { $in: userIds } })
        .sort({ ts: -1 })
        .limit(100)
        .lean()
      for (const evt of events) {
        const key = evt.targetUserId
        historyMap[key] = historyMap[key] || []
        if (historyMap[key].length < 5) {
          historyMap[key].push({
            id: String(evt._id),
            ts: evt.ts,
            text: evt.summary,
            type: evt.type,
            success: evt.success,
          })
        }
      }
    }

    const patients = docs.map((doc) => mapPatient(doc, historyMap, config))

    const avgAgg = await Player.aggregate([
      { $match: filter },
      { $group: { _id: null, avgSeconds: { $avg: '$hospitalTime' } } },
    ])
    const lastRevive = await HospitalEvent.findOne({ type: 'revive', success: true })
      .sort({ ts: -1 })
      .select('ts')
      .lean()

    return res.json({
      patients,
      stats: {
        total,
        avgSeconds: Math.round(avgAgg[0]?.avgSeconds || 0),
        lastRevive: lastRevive?.ts || null,
      },
      hasMore: page * limit < total,
    })
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    console.error('HOSPITAL listPatients error:', err)
    return res.status(500).json({ error: 'Falha ao carregar pacientes' })
  }
}

async function treatPatient(req, res) {
  try {
    const [medic, config] = await Promise.all([ensureAuthPlayer(req), loadHospitalConfig()])
    if (medic.hospitalized) return res.status(400).json({ error: 'Não podes tratar estando internado.' })
    const { targetUserId } = req.body
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId é obrigatório' })
    const patient = await Player.findOne({ user: targetUserId })
    if (!patient || !patient.hospitalized) return res.status(404).json({ error: 'Jogador não está hospitalizado' })

    const defaultReduce = Math.max(30, Number(config.treatSeconds) || 180)
    const reduceSeconds = Math.min(patient.hospitalTime, Math.max(30, Number(req.body.seconds) || defaultReduce))
    const perSecond = Number(config.treatHealthPerSecond) || (1 / 3)
    const healthGain = Math.max(5, Math.round(reduceSeconds * perSecond))

    patient.hospitalTime = Math.max(0, Number(patient.hospitalTime || 0) - reduceSeconds)
    patient.health = Math.min(9999, Number(patient.health || 0) + healthGain)
    if (patient.hospitalTime <= 0) {
      patient.hospitalized = false
    }

    await patient.save()

    await HospitalEvent.create({
      type: 'treat',
      actorUserId: String(medic.user),
      actorName: medic.name,
      targetUserId: String(patient.user),
      targetName: patient.name,
      success: true,
      summary: `${medic.name} tratou ${patient.name}, reduzindo ${reduceSeconds}s de internação.`,
      meta: { reduceSeconds, healthGain },
    })

    return res.json({
      message: 'Tratamento aplicado',
      remainingSeconds: patient.hospitalTime,
      hospitalized: patient.hospitalized,
      health: patient.health,
    })
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    if (err.message === 'Player not found') return res.status(404).json({ error: err.message })
    console.error('HOSPITAL treatPatient error:', err)
    return res.status(500).json({ error: 'Falha ao tratar paciente' })
  }
}

async function revivePatient(req, res) {
  try {
    const [healer, config] = await Promise.all([ensureAuthPlayer(req), loadHospitalConfig()])
    const { targetUserId } = req.body
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId é obrigatório' })
    const patient = await Player.findOne({ user: targetUserId })
    if (!patient || !patient.hospitalized) return res.status(404).json({ error: 'Jogador não está hospitalizado' })

    if (config.allowPaidRevive === false) return res.status(403).json({ error: 'Revives pagos estão desativados pelo admin.' })

    const cost = calcReviveCost(patient, config)
    if (Number(healer.money || 0) < cost) return res.status(400).json({ error: 'Saldo insuficiente para reviver' })

    healer.money = Number(healer.money || 0) - cost
    healer.$locals._txMeta = {
      type: 'hospital_revival',
      description: `Revive ${patient.name}`,
      otherPlayer: patient._id,
      extra: { targetUserId: patient.user },
    }

    patient.hospitalized = false
    patient.hospitalTime = 0
    const floor = Math.max(1, Number(config.reviveHealthFloor) || 150)
    patient.health = Math.max(floor, patient.health || 0)

    await Promise.all([healer.save(), patient.save()])

    await HospitalEvent.create({
      type: 'revive',
      actorUserId: String(healer.user),
      actorName: healer.name,
      targetUserId: String(patient.user),
      targetName: patient.name,
      success: true,
      summary: `${healer.name} pagou $${cost.toLocaleString()} para reviver ${patient.name}.`,
      meta: { cost },
    })

    return res.json({ message: 'Revive concluído', cost })
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    if (err.message === 'Player not found') return res.status(404).json({ error: err.message })
    console.error('HOSPITAL revivePatient error:', err)
    return res.status(500).json({ error: 'Falha ao reviver paciente' })
  }
}

async function listHospitalEvents(req, res) {
  try {
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10))
    const events = await HospitalEvent.find({})
      .sort({ ts: -1 })
      .limit(limit)
      .lean()
    return res.json({ events })
  } catch (err) {
    console.error('HOSPITAL listHospitalEvents error:', err)
    return res.status(500).json({ error: 'Falha ao carregar eventos' })
  }
}

module.exports = {
  listPatients,
  treatPatient,
  revivePatient,
  listHospitalEvents,
}
