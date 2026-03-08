const Player = require('../models/Player')
const { getConfigs, updateConfig, setConfig } = require('../services/worldConfigService')

async function ensureAdmin(req) {
  const userId = req.authUserId
  if (!userId) throw new Error('Unauthorized')
  const admin = await Player.findOne({ user: userId }).select('playerRole name user')
  if (!admin) throw new Error('Unauthorized')
  if (!['Admin', 'Developer'].includes(admin.playerRole)) throw new Error('Forbidden')
  return admin
}

function sanitizeWalkInConfig(payload = {}) {
  if (!payload || typeof payload !== 'object') return null
  const numericShape = {
    refreshIntervalMinutes: { min: 5, max: 240 },
    baselineCostPerHp: { min: 0 },
    minCostPerHp: { min: 0 },
    maxCostPerHp: { min: 0 },
    baselineSecondsPerHp: { min: 0.01 },
    minSecondsPerHp: { min: 0.01 },
    maxSecondsPerHp: { min: 0.01 },
    patientLoadTarget: { min: 1 },
    treatmentsTarget: { min: 1 },
    patientLoadWeight: {},
    treatmentsWeight: {},
    costVariancePercent: { min: 0 },
    timeVariancePercent: { min: 0 },
    targetHealth: { min: 1 },
    maxHpPerSession: { min: 1 },
    cooldownSeconds: { min: 0 },
  }
  const out = {}
  if (Object.prototype.hasOwnProperty.call(payload, 'enabled')) {
    out.enabled = !!payload.enabled
  }
  for (const [key, rules] of Object.entries(numericShape)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const val = asNumber(payload[key], rules)
      if (val != null) out[key] = val
    }
  }
  if (Object.keys(out).length === 0) return null
  return out
}

function asNumber(value, { min = null, max = null, defaultValue = null } = {}) {
  if (value == null || value === '') return defaultValue
  const num = Number(value)
  if (!Number.isFinite(num)) return defaultValue
  let clamped = num
  if (min != null) clamped = Math.max(min, clamped)
  if (max != null) clamped = Math.min(max, clamped)
  return clamped
}

function pickPayload(body, shape) {
  const payload = {}
  for (const [key, rules] of Object.entries(shape)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const opts = typeof rules === 'object' ? rules : { }
      const val = asNumber(body[key], opts)
      if (val != null) payload[key] = val
    }
  }
  return payload
}

function asString(value, fallback = '') {
  if (value == null) return fallback
  return String(value).trim()
}

function ensureStringArray(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((entry) => asString(entry))
      .filter(Boolean)
  }
  return []
}

function sanitizeLootEntries(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => {
      const type = entry?.type === 'item' ? 'item' : 'money'
      const loot = {
        label: asString(entry?.label, 'Loot'),
        type,
        chance: asNumber(entry?.chance, { min: 0, max: 100 }) ?? 0,
      }
      if (type === 'item') {
        loot.itemId = asString(entry?.itemId)
      } else {
        const min = asNumber(entry?.min, { min: 0 }) ?? 0
        const max = asNumber(entry?.max, { min }) ?? min
        loot.min = min
        loot.max = max
      }
      return loot
    })
    .filter((entry) => entry.label)
}

function sanitizeCrimeEntry(crime) {
  if (!crime || typeof crime !== 'object') return null
  const id = asString(crime.id)
  if (!id) return null
  const nerveCost = asNumber(crime.nerveCost, { min: 0 }) ?? 0
  const cooldownSeconds = asNumber(crime.cooldownSeconds, { min: 0 }) ?? 0
  const cashCost = asNumber(crime.cashCost, { min: 0 }) ?? 0
  const payoutMin = asNumber(crime.payoutMin, { min: 0 }) ?? 0
  const payoutMax = asNumber(crime.payoutMax, { min: payoutMin }) ?? payoutMin
  return {
    id,
    title: asString(crime.title, 'Crime sem nome'),
    tag: asString(crime.tag),
    description: asString(crime.description),
    difficulty: asString(crime.difficulty),
    nerveCost,
    cooldownSeconds,
    cashCost,
    payoutMin,
    payoutMax,
    status: asString(crime.status, 'available'),
    cta: asString(crime.cta, 'Iniciar'),
    icon: asString(crime.icon, '🎯'),
    lootNotes: asString(crime.lootNotes),
    loot: sanitizeLootEntries(crime.loot),
    events: {
      success: ensureStringArray(crime?.events?.success),
      fail: ensureStringArray(crime?.events?.fail),
      critical: ensureStringArray(crime?.events?.critical),
    },
  }
}

async function getWorldConfigsController(req, res) {
  try {
    await ensureAdmin(req)
    const configs = await getConfigs(['prison', 'hospital', 'crime', 'crimeCatalog'])
    return res.json({ configs })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao carregar configs' })
  }
}

async function updatePrisonConfig(req, res) {
  try {
    await ensureAdmin(req)
    const shape = {
      jailCapSeconds: { min: 60 },
      minJailSeconds: { min: 30 },
      defaultJailSeconds: { min: 60 },
      bailBase: { min: 0 },
      bailPerBlock: { min: 0 },
      bailBlockSeconds: { min: 60 },
      bailMultiplier: { min: 0.1 },
      breakoutPenaltySeconds: { min: 0 },
      breakoutPenaltyCapSeconds: { min: 0 },
      breakoutBaseChance: { min: 0, max: 1 },
      breakoutLevelBonus: { min: 0, max: 1 },
    }
    const payload = pickPayload(req.body || {}, shape)
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'breakoutAssistEnabled')) {
      payload.breakoutAssistEnabled = !!req.body.breakoutAssistEnabled
    }
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nenhum campo válido enviado' })
    const config = await updateConfig('prison', payload)
    return res.json({ config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar config da prisão' })
  }
}

async function updateHospitalConfig(req, res) {
  try {
    await ensureAdmin(req)
    const shape = {
      hospitalCapSeconds: { min: 60 },
      minHospitalSeconds: { min: 30 },
      defaultHospitalSeconds: { min: 60 },
      treatSeconds: { min: 30 },
      treatHealthPerSecond: { min: 0.01 },
      reviveBase: { min: 0 },
      revivePerBlock: { min: 0 },
      reviveBlockSeconds: { min: 60 },
      reviveLevelFactor: { min: 0 },
      reviveHealthFloor: { min: 1 },
    }
    const payload = pickPayload(req.body || {}, shape)
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'allowPaidRevive')) {
      payload.allowPaidRevive = !!req.body.allowPaidRevive
    }
    const walkInPayload = sanitizeWalkInConfig(req.body?.walkIn)
    if (walkInPayload) payload.walkIn = walkInPayload
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nenhum campo válido enviado' })
    const config = await updateConfig('hospital', payload)
    return res.json({ config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar config do hospital' })
  }
}

async function updateCrimeConfig(req, res) {
  try {
    await ensureAdmin(req)
    const shape = {
      criticalHpLossPercent: { min: 0, max: 100 },
      criticalHpLossFlat: { min: 0 },
      hospitalSeconds: { min: 0 },
      hospitalVarianceSeconds: { min: 0 },
      hospitalHealthFloor: { min: 0 },
      hospitalizeBelowHealth: { min: 0 },
      jailChancePercent: { min: 0, max: 100 },
      jailSeconds: { min: 0 },
      jailVarianceSeconds: { min: 0 },
      jailMaxSeconds: { min: 0 },
    }
    const payload = pickPayload(req.body || {}, shape)
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enableHealthLoss')) payload.enableHealthLoss = !!req.body.enableHealthLoss
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enableHospitalize')) payload.enableHospitalize = !!req.body.enableHospitalize
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enableJail')) payload.enableJail = !!req.body.enableJail
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'logEvents')) payload.logEvents = !!req.body.logEvents

    const severity = req.body?.severityMultipliers
    if (severity && typeof severity === 'object') {
      payload.severityMultipliers = {
        minor: asNumber(severity.minor, { min: 0 }) ?? 0.5,
        moderate: asNumber(severity.moderate, { min: 0 }) ?? 1,
        major: asNumber(severity.major, { min: 0 }) ?? 1.5,
      }
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nenhum campo válido enviado' })
    const config = await updateConfig('crime', payload)
    return res.json({ config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar config de crimes' })
  }
}

async function updateCrimeCatalog(req, res) {
  try {
    await ensureAdmin(req)
    const crimesInput = req.body?.crimes
    if (!Array.isArray(crimesInput) || crimesInput.length === 0) {
      return res.status(400).json({ error: 'Lista de crimes inválida' })
    }
    const crimes = crimesInput
      .map((entry) => sanitizeCrimeEntry(entry))
      .filter(Boolean)
    if (!crimes.length) {
      return res.status(400).json({ error: 'Nenhum crime válido encontrado' })
    }
    const config = await setConfig('crimeCatalog', { crimes })
    return res.json({ config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar catálogo de crimes' })
  }
}

module.exports = {
  getWorldConfigsController,
  updatePrisonConfig,
  updateHospitalConfig,
  updateCrimeConfig,
  updateCrimeCatalog,
}
