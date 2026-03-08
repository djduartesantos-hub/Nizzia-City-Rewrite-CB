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

function sanitizeMapZoneEntry(zone, index = 0) {
  if (!zone || typeof zone !== 'object') return null
  const id = asString(zone.id, `zone_${index}`) || `zone_${index}`
  const key = asString(zone.key, 'zona') || 'zona'
  const label = asString(zone.label, key || `Zona ${index + 1}`) || key || `Zona ${index + 1}`
  const color = asString(zone.color, '#8a946f') || '#8a946f'
  const districtName = asString(zone.districtName, label) || label
  const density = asNumber(zone.density, { min: 0, max: 1, defaultValue: 0.4 })
  const reveal = asNumber(zone.reveal, { min: 0, max: 1, defaultValue: 0.8 })
  const col = asNumber(zone.col, { min: 0, defaultValue: 0 })
  const row = asNumber(zone.row, { min: 0, defaultValue: 0 })
  const cw = asNumber(zone.cw, { min: 1, defaultValue: 1 })
  const rh = asNumber(zone.rh, { min: 1, defaultValue: 1 })
  return {
    id,
    key,
    label,
    color,
    density,
    col,
    row,
    cw,
    rh,
    reveal,
    districtName,
  }
}

async function listCityMapZones(req, res) {
  try {
    await ensureAdmin(req)
    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    return res.json({
      zones: Array.isArray(cityMap.zones) ? cityMap.zones : [],
      cityMap,
    })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao listar zonas do mapa' })
  }
}

async function createCityMapZone(req, res) {
  try {
    await ensureAdmin(req)
    const zone = sanitizeMapZoneEntry(req.body || {}, Date.now())
    if (!zone) return res.status(400).json({ error: 'Zona inválida' })

    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const zones = Array.isArray(cityMap.zones) ? [...cityMap.zones] : []
    if (zones.some((entry) => asString(entry?.id) === zone.id)) {
      return res.status(409).json({ error: 'Já existe uma zona com esse ID' })
    }
    zones.push(zone)
    const config = await updateConfig('cityMap', { zones })
    return res.status(201).json({ zone, config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao criar zona do mapa' })
  }
}

async function updateCityMapZone(req, res) {
  try {
    await ensureAdmin(req)
    const zoneId = asString(req.params?.zoneId)
    if (!zoneId) return res.status(400).json({ error: 'zoneId inválido' })

    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const zones = Array.isArray(cityMap.zones) ? [...cityMap.zones] : []
    const index = zones.findIndex((entry) => asString(entry?.id) === zoneId)
    if (index < 0) return res.status(404).json({ error: 'Zona não encontrada' })

    const merged = { ...zones[index], ...(req.body || {}), id: zoneId }
    const zone = sanitizeMapZoneEntry(merged, index)
    if (!zone) return res.status(400).json({ error: 'Zona inválida' })

    zones[index] = zone
    const config = await updateConfig('cityMap', { zones })
    return res.json({ zone, config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao atualizar zona do mapa' })
  }
}

async function deleteCityMapZone(req, res) {
  try {
    await ensureAdmin(req)
    const zoneId = asString(req.params?.zoneId)
    if (!zoneId) return res.status(400).json({ error: 'zoneId inválido' })

    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const zones = Array.isArray(cityMap.zones) ? [...cityMap.zones] : []
    const filtered = zones.filter((entry) => asString(entry?.id) !== zoneId)
    if (filtered.length === zones.length) return res.status(404).json({ error: 'Zona não encontrada' })

    const config = await updateConfig('cityMap', { zones: filtered })
    return res.json({ ok: true, config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao remover zona do mapa' })
  }
}

function sanitizeMapLocationEntry(loc) {
  if (!loc || typeof loc !== 'object') return null
  const key = asString(loc.key)
  const name = asString(loc.name)
  if (!key || !name) return null
  const col = asNumber(loc.col, { min: 0, defaultValue: 0 })
  const row = asNumber(loc.row, { min: 0, defaultValue: 0 })
  return { key, name, col, row }
}

function sanitizeCityMapPayload(input = {}) {
  if (!input || typeof input !== 'object') return null
  const out = {}
  if (Object.prototype.hasOwnProperty.call(input, 'imageUrl')) {
    out.imageUrl = asString(input.imageUrl, '/map-reference.png') || '/map-reference.png'
  }
  if (input.grid && typeof input.grid === 'object') {
    out.grid = {
      cols: asNumber(input.grid.cols, { min: 4, max: 200, defaultValue: 20 }),
      rows: asNumber(input.grid.rows, { min: 4, max: 200, defaultValue: 14 }),
      majorCols: asNumber(input.grid.majorCols, { min: 1, max: 50, defaultValue: 6 }),
      majorRows: asNumber(input.grid.majorRows, { min: 1, max: 50, defaultValue: 4 }),
      subDivisionFactor: asNumber(input.grid.subDivisionFactor, { min: 1, max: 8, defaultValue: 2 }),
      maxSubDivisions: asNumber(input.grid.maxSubDivisions, { min: 1, max: 8, defaultValue: 3 }),
    }
  }
  if (input.zoom && typeof input.zoom === 'object') {
    out.zoom = {
      min: asNumber(input.zoom.min, { min: 0.25, max: 10, defaultValue: 1 }),
      max: asNumber(input.zoom.max, { min: 0.5, max: 12, defaultValue: 4 }),
      step: asNumber(input.zoom.step, { min: 0.05, max: 2, defaultValue: 0.25 }),
      initial: asNumber(input.zoom.initial, { min: 0.25, max: 10, defaultValue: 1 }),
    }
    if (out.zoom.max < out.zoom.min) out.zoom.max = out.zoom.min
    out.zoom.initial = Math.min(out.zoom.max, Math.max(out.zoom.min, out.zoom.initial))
  }
  if (Array.isArray(input.zones)) {
    out.zones = input.zones
      .map((entry, idx) => sanitizeMapZoneEntry(entry, idx))
      .filter(Boolean)
  }
  if (Array.isArray(input.locations)) {
    out.locations = input.locations
      .map((entry) => sanitizeMapLocationEntry(entry))
      .filter(Boolean)
  }
  if (!Object.keys(out).length) return null
  return out
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
    const configs = await getConfigs(['prison', 'hospital', 'crime', 'crimeCatalog', 'cityMap'])
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

async function updateCityMapConfig(req, res) {
  try {
    await ensureAdmin(req)
    const payload = sanitizeCityMapPayload(req.body || {})
    if (!payload) return res.status(400).json({ error: 'Nenhum campo válido enviado' })
    const config = await updateConfig('cityMap', payload)
    return res.json({ config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar config do mapa' })
  }
}

async function getPublicCityMapConfig(req, res) {
  try {
    const configs = await getConfigs(['cityMap'])
    return res.json({ cityMap: configs.cityMap || {} })
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao carregar config do mapa' })
  }
}

module.exports = {
  getWorldConfigsController,
  updatePrisonConfig,
  updateHospitalConfig,
  updateCrimeConfig,
  updateCrimeCatalog,
  updateCityMapConfig,
  listCityMapZones,
  createCityMapZone,
  updateCityMapZone,
  deleteCityMapZone,
  getPublicCityMapConfig,
}
