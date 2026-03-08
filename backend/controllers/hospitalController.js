const Player = require('../models/Player')
const HospitalEvent = require('../models/HospitalEvent')
const { getConfig } = require('../services/worldConfigService')

const WALK_IN_EVENT_TYPES = ['treat', 'walk_in']
const walkInCache = {
  key: null,
  stats: null,
}

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

function clampNumber(value, min, max) {
  let next = Number(value)
  if (!Number.isFinite(next)) next = 0
  if (min != null) next = Math.max(min, next)
  if (max != null) next = Math.min(max, next)
  return next
}

function resolveTargetHealth(walkInConfig) {
  const fallbackTarget = 100
  return Math.max(1, Number(walkInConfig?.targetHealth) || fallbackTarget)
}

function getWalkInConfig(config) {
  return config?.walkIn || {}
}

function ensureWalkInAccess(player, walkInConfig) {
  if (!walkInConfig?.enabled) {
    const err = new Error('Tratamentos walk-in estão desativados pelo admin.')
    err.status = 403
    throw err
  }
  if (player.hospitalized) {
    const err = new Error('Não podes tratar estando internado.')
    err.status = 400
    throw err
  }
}

function getWalkInIntervalMs(walkInConfig) {
  const minutes = Math.max(5, Number(walkInConfig.refreshIntervalMinutes) || 30)
  return minutes * 60 * 1000
}

async function loadWalkInStats(walkInConfig) {
  const intervalMs = getWalkInIntervalMs(walkInConfig)
  const now = Date.now()
  const bucketStartMs = Math.floor(now / intervalMs) * intervalMs
  const bucketEndMs = bucketStartMs + intervalMs
  const cacheKey = `${bucketStartMs}:${intervalMs}`
  if (walkInCache.key === cacheKey && walkInCache.stats) {
    return walkInCache.stats
  }
  const [patientLoad, treatmentCount] = await Promise.all([
    Player.countDocuments({ hospitalized: true }),
    HospitalEvent.countDocuments({
      type: { $in: WALK_IN_EVENT_TYPES },
      ts: { $gte: new Date(bucketStartMs) },
    }),
  ])
  const stats = {
    patientLoad,
    treatmentCount,
    bucketStart: new Date(bucketStartMs),
    bucketEnd: new Date(bucketEndMs),
    intervalSeconds: Math.round(intervalMs / 1000),
  }
  walkInCache.key = cacheKey
  walkInCache.stats = stats
  return stats
}

function computeWalkInRates(walkInConfig, stats) {
  const baselineCost = Math.max(1, Number(walkInConfig.baselineCostPerHp) || 100)
  const baselineSeconds = Math.max(0.01, Number(walkInConfig.baselineSecondsPerHp) || 1)
  const minCost = Math.max(1, Number(walkInConfig.minCostPerHp) || baselineCost)
  const maxCost = Math.max(minCost, Number(walkInConfig.maxCostPerHp) || baselineCost)
  const minSeconds = Math.max(0.01, Number(walkInConfig.minSecondsPerHp) || baselineSeconds)
  const maxSeconds = Math.max(minSeconds, Number(walkInConfig.maxSecondsPerHp) || baselineSeconds)
  const loadTarget = Math.max(1, Number(walkInConfig.patientLoadTarget) || 1)
  const treatmentsTarget = Math.max(1, Number(walkInConfig.treatmentsTarget) || 1)
  const loadScore = stats.patientLoad / loadTarget
  const treatmentScore = stats.treatmentCount / treatmentsTarget
  const weightLoad = Number.isFinite(walkInConfig.patientLoadWeight)
    ? walkInConfig.patientLoadWeight
    : 0.6
  const weightTreat = Number.isFinite(walkInConfig.treatmentsWeight)
    ? walkInConfig.treatmentsWeight
    : 0.4
  const totalWeight = weightLoad + weightTreat || 1
  const weightedScore = (weightLoad * loadScore + weightTreat * treatmentScore) / totalWeight
  const normalizedScore = clampNumber(weightedScore, 0, 3)
  const costVariance = Math.max(0, Number(walkInConfig.costVariancePercent) || 0) / 100
  const timeVariance = Math.max(0, Number(walkInConfig.timeVariancePercent) || 0) / 100

  let costPerHp = baselineCost * (1 + costVariance * (normalizedScore - 1))
  costPerHp = clampNumber(costPerHp, minCost, maxCost)
  let secondsPerHp = baselineSeconds * (1 + timeVariance * (normalizedScore - 1))
  secondsPerHp = clampNumber(secondsPerHp, minSeconds, maxSeconds)

  return {
    costPerHp,
    secondsPerHp,
    normalizedScore,
  }
}

async function buildWalkInQuote(player, config) {
  const walkInConfig = getWalkInConfig(config)
  ensureWalkInAccess(player, walkInConfig)
  const stats = await loadWalkInStats(walkInConfig)
  const rates = computeWalkInRates(walkInConfig, stats)
  const targetHealth = resolveTargetHealth(walkInConfig)
  const rawHealth = Number(player.health || 0)
  const currentHealth = walkInConfig.autoClampHealth ? clampNumber(rawHealth, 0, targetHealth) : Math.max(0, rawHealth)
  const missingHp = Math.max(0, targetHealth - currentHealth)
  const rawMaxSession = Number(walkInConfig.maxHpPerSession)
  const maxSession = clampNumber(
    Number.isFinite(rawMaxSession) ? rawMaxSession : missingHp || targetHealth,
    1,
    targetHealth
  )
  const hpToRecover = Math.min(missingHp, maxSession)
  const totalCost = Math.round(rates.costPerHp * hpToRecover)
  const totalSeconds = hpToRecover > 0 ? Math.max(1, Math.round(rates.secondsPerHp * hpToRecover)) : 0
  return {
    patientLoad: stats.patientLoad,
    treatmentsThisWindow: stats.treatmentCount,
    bucket: {
      startsAt: stats.bucketStart,
      endsAt: stats.bucketEnd,
      intervalSeconds: stats.intervalSeconds,
    },
    pressureScore: Number(rates.normalizedScore.toFixed(3)),
    perHpCost: Math.round(rates.costPerHp),
    perHpSeconds: Number(rates.secondsPerHp.toFixed(3)),
    missingHp,
    hpToRecover,
    totalCost,
    totalSeconds,
    currentHealth,
    projectedHealth: Math.min(targetHealth, currentHealth + hpToRecover),
    targetHealth,
    maxHpPerSession: maxSession,
    cooldownSeconds: Math.max(0, Number(walkInConfig.cooldownSeconds) || 0),
  }
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

async function getWalkInQuote(req, res) {
  try {
    const [player, config] = await Promise.all([ensureAuthPlayer(req), loadHospitalConfig()])
    const quote = await buildWalkInQuote(player, config)
    const cooldownRemaining = Math.max(0, Number(player.cooldowns?.medicalCooldown || 0))
    return res.json({
      quote,
      cooldownRemaining,
      canAfford: Number(player.money || 0) >= quote.totalCost,
      hasCooldown: cooldownRemaining > 0,
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    if (err.message === 'Player not found') return res.status(404).json({ error: err.message })
    console.error('HOSPITAL getWalkInQuote error:', err)
    return res.status(500).json({ error: 'Falha ao calcular tratamento walk-in' })
  }
}

async function startWalkInTreatment(req, res) {
  try {
    const [player, config] = await Promise.all([ensureAuthPlayer(req), loadHospitalConfig()])
    const cooldownRemaining = Math.max(0, Number(player.cooldowns?.medicalCooldown || 0))
    if (cooldownRemaining > 0) {
      return res.status(400).json({ error: 'Ainda estás em recuperação. Aguarda o cooldown.' })
    }
    const quote = await buildWalkInQuote(player, config)
    if (quote.hpToRecover <= 0) {
      return res.status(400).json({ error: 'Já estás com a vida cheia.', quote })
    }
    if (Number(player.money || 0) < quote.totalCost) {
      return res.status(400).json({ error: 'Saldo insuficiente para o tratamento.', quote })
    }

    player.money = Number(player.money || 0) - quote.totalCost
    player.$locals._txMeta = {
      type: 'hospital_walk_in',
      description: 'Tratamento walk-in',
      extra: { hpRestored: quote.hpToRecover, cost: quote.totalCost },
    }
    player.health = quote.projectedHealth
    if (!player.cooldowns) player.cooldowns = {}
    player.cooldowns.medicalCooldown = Math.round(quote.totalSeconds + quote.cooldownSeconds)

    await player.save()

    await HospitalEvent.create({
      type: 'walk_in',
      actorUserId: String(player.user),
      actorName: player.name,
      targetUserId: String(player.user),
      targetName: player.name,
      success: true,
      summary: `${player.name} realizou tratamento walk-in recuperando ${quote.hpToRecover} HP por $${quote.totalCost.toLocaleString()}.`,
      meta: {
        hpRestored: quote.hpToRecover,
        cost: quote.totalCost,
        treatmentSeconds: quote.totalSeconds,
      },
    })

    const cooldownRemainingAfter = Math.max(0, Number(player.cooldowns.medicalCooldown || 0))

    return res.json({
      message: 'Tratamento iniciado',
      health: player.health,
      money: player.money,
      cooldownRemaining: cooldownRemainingAfter,
      quote,
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    if (err.message === 'Player not found') return res.status(404).json({ error: err.message })
    console.error('HOSPITAL startWalkInTreatment error:', err)
    return res.status(500).json({ error: 'Falha ao iniciar tratamento walk-in' })
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
  getWalkInQuote,
  startWalkInTreatment,
}
