const Player = require('../models/Player')
const { getConfigs, updateConfig, setConfig } = require('../services/worldConfigService')

const cityEventsRuntime = new Map()

function resetCityEventsRuntime() {
  cityEventsRuntime.clear()
}

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

async function getPublicCityEvents(req, res) {
  try {
    const seed = Number(req.params?.seed || req.query?.seed || 1) || 1
    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const events = getRuntimeCityEventsSnapshot(cityMap, seed)
    return res.json({
      seed,
      serverTime: Date.now(),
      events,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Falha ao carregar eventos da cidade' })
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
    resetCityEventsRuntime()
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
    resetCityEventsRuntime()
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
    resetCityEventsRuntime()
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

function sanitizeNumericRange(range, { min = 0, max = null, fallback = [0, 0] } = {}) {
  if (!Array.isArray(range) || range.length < 2) return fallback
  const start = asNumber(range[0], { min, defaultValue: fallback[0] })
  const end = asNumber(range[1], { min: start, max, defaultValue: fallback[1] })
  return [start, end]
}

function sanitizeEventRewardConfig(entry) {
  const reward = entry && typeof entry === 'object' ? entry : {}
  return {
    money: sanitizeNumericRange(reward.money, { min: 0, fallback: [500, 1500] }),
    xp: sanitizeNumericRange(reward.xp, { min: 0, fallback: [20, 80] }),
    rep: sanitizeNumericRange(reward.rep, { min: 0, fallback: [1, 4] }),
    items: ensureStringArray(reward.items),
  }
}

function sanitizeCityMapEventTypeEntry(entry, idx = 0) {
  if (!entry || typeof entry !== 'object') return null
  const key = asString(entry.key, `event_${idx + 1}`)
  const name = asString(entry.name, key)
  if (!key || !name) return null
  const modeRaw = asString(entry.mode, 'solo').toLowerCase()
  const mode = modeRaw === 'group' ? 'group' : 'solo'
  const zones = ensureStringArray(entry.zones)
  return {
    key,
    name,
    icon: asString(entry.icon, '⚡') || '⚡',
    danger: asString(entry.danger, 'Médio') || 'Médio',
    riskClass: asString(entry.riskClass, 'medium') || 'medium',
    mode,
    durationRange: sanitizeNumericRange(entry.durationRange, { min: 30, fallback: [120, 240] }),
    participationDuration: asNumber(entry.participationDuration, { min: 10, defaultValue: 90 }),
    zones,
    desc: asString(entry.desc, ''),
    reward: sanitizeEventRewardConfig(entry.reward),
    phases: ensureStringArray(entry.phases),
    twists: Array.isArray(entry.twists)
      ? entry.twists
        .map((tw) => ({
          text: asString(tw?.text),
          effect: ['good', 'bad', 'neutral'].includes(asString(tw?.effect).toLowerCase()) ? asString(tw?.effect).toLowerCase() : 'neutral',
        }))
        .filter((tw) => tw.text)
      : [],
  }
}

function sanitizeCityMapEventsPayload(events = {}) {
  if (!events || typeof events !== 'object') return null
  const out = {}
  if (Object.prototype.hasOwnProperty.call(events, 'refreshIntervalSeconds')) {
    out.refreshIntervalSeconds = asNumber(events.refreshIntervalSeconds, { min: 5, max: 300, defaultValue: 20 })
  }
  if (Object.prototype.hasOwnProperty.call(events, 'maxActiveEvents')) {
    out.maxActiveEvents = asNumber(events.maxActiveEvents, { min: 1, max: 50, defaultValue: 12 })
  }
  if (Object.prototype.hasOwnProperty.call(events, 'spawnGraceSeconds')) {
    out.spawnGraceSeconds = asNumber(events.spawnGraceSeconds, { min: 0, max: 600, defaultValue: 45 })
  }
  if (Array.isArray(events.types)) {
    out.types = events.types
      .map((entry, idx) => sanitizeCityMapEventTypeEntry(entry, idx))
      .filter(Boolean)
  }
  if (!Object.keys(out).length) return null
  return out
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
  if (input.events && typeof input.events === 'object') {
    const events = sanitizeCityMapEventsPayload(input.events)
    if (events) out.events = events
  }
  if (!Object.keys(out).length) return null
  return out
}

function makeSeededRng(seed = 1) {
  let s = (Number(seed) || 1) >>> 0
  return {
    next() {
      s = (1664525 * s + 1013904223) >>> 0
      return s / 0x100000000
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    pick(arr = []) {
      if (!arr.length) return null
      return arr[this.int(0, arr.length - 1)]
    },
  }
}

function weightedPickType(types, zoneKey, rng) {
  if (!types.length) return null
  const weighted = types.map((entry) => {
    const score = Array.isArray(entry.zones) && entry.zones.includes(zoneKey) ? 4 : 1
    return { entry, score }
  })
  const total = weighted.reduce((acc, item) => acc + item.score, 0)
  let point = rng.next() * total
  for (const item of weighted) {
    point -= item.score
    if (point <= 0) return item.entry
  }
  return weighted[0].entry
}

function rollFromRange(range, rng, fallback = [0, 0]) {
  const arr = Array.isArray(range) && range.length >= 2 ? range : fallback
  const min = Number(arr[0]) || 0
  const max = Number(arr[1]) || min
  return rng.int(Math.min(min, max), Math.max(min, max))
}

function distance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y))
}

function buildCityEventsSnapshot(cityMap, seedInput = 1, options = {}) {
  const zones = Array.isArray(cityMap?.zones) ? cityMap.zones : []
  const eventsConfig = cityMap?.events && typeof cityMap.events === 'object' ? cityMap.events : {}
  const types = Array.isArray(eventsConfig.types) ? eventsConfig.types : []
  if (!zones.length || !types.length) return []

  const seed = Number(seedInput) || 1
  const now = Number.isFinite(Number(options?.nowMs)) ? Number(options.nowMs) : Date.now()
  const refreshIntervalSeconds = Math.max(5, Number(eventsConfig.refreshIntervalSeconds) || 20)
  const requestedGeneration = Number(options?.generationKey)
  const snapshotWindow = Number.isFinite(requestedGeneration)
    ? requestedGeneration
    : Math.floor(now / (refreshIntervalSeconds * 1000))
  const rng = makeSeededRng(seed * 8191 + snapshotWindow)
  const maxActive = Math.max(1, Number(eventsConfig.maxActiveEvents) || 12)
  const count = Math.max(1, Math.min(maxActive, Number(options?.count) || maxActive))
  const spawnGrace = Math.max(0, Number(eventsConfig.spawnGraceSeconds) || 45)
  const grid = cityMap?.grid && typeof cityMap.grid === 'object' ? cityMap.grid : {}
  const gridCols = Math.max(1, Number(grid.cols) || 20)
  const gridRows = Math.max(1, Number(grid.rows) || 14)
  const cityW = 2000
  const cityH = 1400
  const cellW = cityW / gridCols
  const cellH = cityH / gridRows
  const minEventDistance = 120
  const occupied = Array.isArray(options?.existingEvents)
    ? options.existingEvents
      .filter((ev) => Number.isFinite(Number(ev?.x)) && Number.isFinite(Number(ev?.y)))
      .map((ev) => ({ x: Number(ev.x), y: Number(ev.y) }))
    : []
  const events = []

  for (let i = 0; i < count; i += 1) {
    const zone = rng.pick(zones)
    if (!zone) break
    const type = weightedPickType(types, zone.key, rng)
    if (!type) continue

    const duration = rollFromRange(type.durationRange, rng, [120, 240])
    const participationDuration = Math.max(10, Number(type.participationDuration) || 90)
    const elapsedMax = Math.max(0, duration - spawnGrace)
    const elapsed = rng.int(0, elapsedMax)
    const startedAt = now - elapsed * 1000
    const rewardCfg = type.reward || {}
    const zoneCol = Number(zone?.col) || 0
    const zoneRow = Number(zone?.row) || 0
    const zoneCW = Math.max(1, Number(zone?.cw) || 1)
    const zoneRH = Math.max(1, Number(zone?.rh) || 1)
    const zoneW = zoneCW * cellW
    const zoneH = zoneRH * cellH
    const zoneX = (zoneCol + zoneCW * 0.5) * cellW
    const zoneY = (zoneRow + zoneRH * 0.5) * cellH
    let best = null
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const jitterX = (rng.next() * 2 - 1) * zoneW * 0.35
      const jitterY = (rng.next() * 2 - 1) * zoneH * 0.35
      const candidate = {
        x: Math.min(cityW - 40, Math.max(40, zoneX + jitterX)),
        y: Math.min(cityH - 40, Math.max(40, zoneY + jitterY)),
      }
      const nearest = occupied.length
        ? occupied.reduce((min, point) => Math.min(min, distance(candidate, point)), Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY
      if (!best || nearest > best.nearest) best = { ...candidate, nearest }
      if (nearest >= minEventDistance) break
    }
    const x = best?.x ?? Math.min(cityW - 40, Math.max(40, zoneX))
    const y = best?.y ?? Math.min(cityH - 40, Math.max(40, zoneY))

    events.push({
      id: `city_${seed}_${snapshotWindow}_${i}`,
      typeKey: type.key,
      name: type.name,
      icon: type.icon,
      danger: type.danger,
      riskClass: type.riskClass,
      mode: type.mode || 'solo',
      zoneKey: zone.key,
      zoneLabel: zone.label,
      description: type.desc || '',
      x,
      y,
      startedAt,
      duration,
      participationDuration,
      reward: {
        money: rollFromRange(rewardCfg.money, rng, [500, 1500]),
        xp: rollFromRange(rewardCfg.xp, rng, [20, 80]),
        rep: rollFromRange(rewardCfg.rep, rng, [1, 4]),
        item: Array.isArray(rewardCfg.items) && rewardCfg.items.length ? rng.pick(rewardCfg.items) : 'Nenhum',
      },
      phases: Array.isArray(type.phases) ? type.phases : [],
      twists: Array.isArray(type.twists) ? type.twists : [],
    })
    occupied.push({ x, y })
  }

  return events
}

function getRuntimeCityEventsSnapshot(cityMap, seedInput = 1) {
  const eventsConfig = cityMap?.events && typeof cityMap.events === 'object' ? cityMap.events : {}
  const maxActive = Math.max(1, Number(eventsConfig.maxActiveEvents) || 12)
  const seed = Number(seedInput) || 1
  const now = Date.now()
  const runtime = cityEventsRuntime.get(seed) || { generation: 0, events: [] }
  const active = Array.isArray(runtime.events)
    ? runtime.events.filter((ev) => Number(ev?.startedAt) + Number(ev?.duration || 0) * 1000 > now)
    : []

  let nextEvents = active.slice(0, maxActive)
  if (nextEvents.length < maxActive) {
    runtime.generation += 1
    const missing = maxActive - nextEvents.length
    const spawned = buildCityEventsSnapshot(cityMap, seed, {
      count: missing,
      nowMs: now,
      generationKey: runtime.generation,
      existingEvents: nextEvents,
    })
    nextEvents = nextEvents.concat(spawned)
  }

  runtime.events = nextEvents
  cityEventsRuntime.set(seed, runtime)
  return nextEvents
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
    resetCityEventsRuntime()
    return res.json({ config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar config do mapa' })
  }
}

async function getCityMapEventsConfig(req, res) {
  try {
    await ensureAdmin(req)
    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    return res.json({
      events: cityMap.events || {},
      cityMap,
    })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao carregar config de eventos do mapa' })
  }
}

async function updateCityMapEventsConfig(req, res) {
  try {
    await ensureAdmin(req)
    const payload = sanitizeCityMapEventsPayload(req.body || {})
    if (!payload) return res.status(400).json({ error: 'Nenhum campo válido enviado' })
    const configs = await getConfigs(['cityMap'])
    const existingEvents = configs?.cityMap?.events && typeof configs.cityMap.events === 'object'
      ? configs.cityMap.events
      : {}
    const nextEvents = {
      ...existingEvents,
      ...payload,
      types: Array.isArray(payload.types)
        ? payload.types
        : Array.isArray(existingEvents.types)
          ? existingEvents.types
          : [],
    }
    const config = await updateConfig('cityMap', { events: nextEvents })
    resetCityEventsRuntime()
    return res.json({ config, events: config?.events || {} })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao guardar config de eventos do mapa' })
  }
}

async function listCityMapEventTypes(req, res) {
  try {
    await ensureAdmin(req)
    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const types = Array.isArray(cityMap?.events?.types) ? cityMap.events.types : []
    return res.json({
      types,
      events: cityMap.events || {},
      cityMap,
    })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao listar tipos de evento do mapa' })
  }
}

async function createCityMapEventType(req, res) {
  try {
    await ensureAdmin(req)
    const eventType = sanitizeCityMapEventTypeEntry(req.body || {}, Date.now())
    if (!eventType) return res.status(400).json({ error: 'Tipo de evento inválido' })

    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const events = cityMap.events && typeof cityMap.events === 'object' ? cityMap.events : {}
    const types = Array.isArray(events.types) ? [...events.types] : []
    if (types.some((entry) => asString(entry?.key) === eventType.key)) {
      return res.status(409).json({ error: 'Já existe um tipo de evento com essa key' })
    }

    types.push(eventType)
    const config = await updateConfig('cityMap', { events: { ...events, types } })
    resetCityEventsRuntime()
    return res.status(201).json({ eventType, config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao criar tipo de evento do mapa' })
  }
}

async function updateCityMapEventType(req, res) {
  try {
    await ensureAdmin(req)
    const typeKey = asString(req.params?.typeKey)
    if (!typeKey) return res.status(400).json({ error: 'typeKey inválida' })

    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const events = cityMap.events && typeof cityMap.events === 'object' ? cityMap.events : {}
    const types = Array.isArray(events.types) ? [...events.types] : []
    const index = types.findIndex((entry) => asString(entry?.key) === typeKey)
    if (index < 0) return res.status(404).json({ error: 'Tipo de evento não encontrado' })

    const merged = { ...types[index], ...(req.body || {}), key: typeKey }
    const eventType = sanitizeCityMapEventTypeEntry(merged, index)
    if (!eventType) return res.status(400).json({ error: 'Tipo de evento inválido' })

    types[index] = eventType
    const config = await updateConfig('cityMap', { events: { ...events, types } })
    resetCityEventsRuntime()
    return res.json({ eventType, config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao atualizar tipo de evento do mapa' })
  }
}

async function deleteCityMapEventType(req, res) {
  try {
    await ensureAdmin(req)
    const typeKey = asString(req.params?.typeKey)
    if (!typeKey) return res.status(400).json({ error: 'typeKey inválida' })

    const configs = await getConfigs(['cityMap'])
    const cityMap = configs.cityMap || {}
    const events = cityMap.events && typeof cityMap.events === 'object' ? cityMap.events : {}
    const types = Array.isArray(events.types) ? [...events.types] : []
    const filtered = types.filter((entry) => asString(entry?.key) !== typeKey)
    if (filtered.length === types.length) return res.status(404).json({ error: 'Tipo de evento não encontrado' })

    const config = await updateConfig('cityMap', { events: { ...events, types: filtered } })
    resetCityEventsRuntime()
    return res.json({ ok: true, config })
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : err.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: err.message || 'Falha ao remover tipo de evento do mapa' })
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
  getPublicCityEvents,
  getCityMapEventsConfig,
  updateCityMapEventsConfig,
  listCityMapEventTypes,
  createCityMapEventType,
  updateCityMapEventType,
  deleteCityMapEventType,
}
