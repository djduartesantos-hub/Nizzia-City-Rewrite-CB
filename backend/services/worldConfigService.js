const WorldConfig = require('../models/WorldConfig')
const defaults = require('../config/worldDefaults')

function deepClone(obj) {
  if (Array.isArray(obj)) return obj.map((entry) => deepClone(entry))
  if (obj && typeof obj === 'object') {
    const clone = {}
    for (const [key, value] of Object.entries(obj)) {
      clone[key] = deepClone(value)
    }
    return clone
  }
  return obj
}

function mergeConfig(base, override) {
  if (override == null) return deepClone(base)
  if (base == null) return deepClone(override)
  if (Array.isArray(base) || Array.isArray(override)) {
    return deepClone(override)
  }
  if (typeof base !== 'object' || typeof override !== 'object') {
    return deepClone(override)
  }
  const result = { ...deepClone(base) }
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfig(base[key], value)
    } else {
      result[key] = deepClone(value)
    }
  }
  return result
}

async function getConfig(key) {
  const fallback = defaults[key] || {}
  const doc = await WorldConfig.findOne({ key }).lean()
  if (!doc) return deepClone(fallback)
  return mergeConfig(fallback, doc.data || {})
}

async function getConfigs(keys = []) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))]
  const docs = uniqueKeys.length
    ? await WorldConfig.find({ key: { $in: uniqueKeys } }).lean()
    : []
  const map = {}
  for (const key of uniqueKeys) {
    const fallback = defaults[key] || {}
    const entry = docs.find((doc) => doc.key === key)
    map[key] = entry ? mergeConfig(fallback, entry.data || {}) : deepClone(fallback)
  }
  return map
}

async function setConfig(key, data) {
  if (!data || typeof data !== 'object') throw new Error('data must be an object')
  const fallback = defaults[key] || {}
  const doc = await WorldConfig.findOneAndUpdate(
    { key },
    { $set: { data } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  return mergeConfig(fallback, doc.data || {})
}

async function updateConfig(key, patch) {
  if (!patch || typeof patch !== 'object') throw new Error('patch must be an object')
  const existingDoc = await WorldConfig.findOne({ key })
  const fallback = defaults[key] || {}
  const current = existingDoc ? mergeConfig(fallback, existingDoc.data || {}) : deepClone(fallback)
  const next = mergeConfig(current, patch)
  if (existingDoc) {
    existingDoc.data = next
    existingDoc.markModified('data')
    await existingDoc.save()
  } else {
    await WorldConfig.create({ key, data: next })
  }
  return mergeConfig(fallback, next)
}

async function getAllConfigs() {
  const keys = Object.keys(defaults)
  return getConfigs(keys)
}

module.exports = {
  getConfig,
  getConfigs,
  getAllConfigs,
  setConfig,
  updateConfig,
}
