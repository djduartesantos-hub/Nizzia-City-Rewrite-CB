const Player = require('../models/Player')
const { getConfigs, updateConfig } = require('../services/worldConfigService')

async function ensureAdmin(req) {
  const userId = req.authUserId
  if (!userId) throw new Error('Unauthorized')
  const admin = await Player.findOne({ user: userId }).select('playerRole name user')
  if (!admin) throw new Error('Unauthorized')
  if (!['Admin', 'Developer'].includes(admin.playerRole)) throw new Error('Forbidden')
  return admin
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

async function getWorldConfigsController(req, res) {
  try {
    await ensureAdmin(req)
    const configs = await getConfigs(['prison', 'hospital', 'crime'])
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
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nenhum campo válido enviado' })
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'allowPaidRevive')) {
      payload.allowPaidRevive = !!req.body.allowPaidRevive
    }
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

module.exports = {
  getWorldConfigsController,
  updatePrisonConfig,
  updateHospitalConfig,
  updateCrimeConfig,
}
