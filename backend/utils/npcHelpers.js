function randomRange(min, max) {
  const lo = Number(min)
  const hi = Number(max)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0
  if (hi <= lo) return lo
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

function randomFrom(arr, rng = Math.random) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const i = Math.floor(rng() * arr.length)
  return arr[i]
}

function weightedRandom(entries, rng = Math.random) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  const weighted = entries
    .filter((e) => Number(e?.chance) > 0)
    .map((e) => ({ ...e, chance: Number(e.chance) }))
  if (weighted.length === 0) return null

  const total = weighted.reduce((s, e) => s + e.chance, 0)
  let roll = rng() * total
  for (const item of weighted) {
    roll -= item.chance
    if (roll <= 0) return item
  }
  return weighted[weighted.length - 1]
}

function createSeededRandom(seed) {
  let t = Number(seed) || Date.now()
  return function seeded() {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST_NAMES = [
  'Mateus', 'Rita', 'Leo', 'Mara', 'Bruno', 'Sofia', 'Caio', 'Diana', 'Nuno', 'Ines',
  'Gustavo', 'Helena', 'Tiago', 'Bia', 'Igor', 'Lara', 'Ruben', 'Carla', 'Vitor', 'Maya'
]
const LAST_NAMES = [
  'Silva', 'Costa', 'Santos', 'Pereira', 'Oliveira', 'Mendes', 'Lopes', 'Rocha', 'Souza', 'Cardoso'
]

function generateNPCName(rng = Math.random) {
  return `${randomFrom(FIRST_NAMES, rng)} ${randomFrom(LAST_NAMES, rng)}`
}

const SENTIMENT_BY_INTERACTION = {
  robbed: -70,
  helped: 40,
  attacked: -80,
  paid: 30,
  talked: 8,
  arrested: -90,
  released: 70,
  betrayed: -100,
  saved: 85,
}

function getSentimentForInteraction(type) {
  return Number(SENTIMENT_BY_INTERACTION[type] || 0)
}

function getSentimentLabel(total) {
  const n = Number(total) || 0
  if (n >= 120) return 'aliado'
  if (n >= 40) return 'amigavel'
  if (n > -40) return 'neutro'
  if (n > -120) return 'hostil'
  return 'inimigo'
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return 0
  const [h, m] = hhmm.split(':').map(Number)
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

function getCurrentScheduleSlot(schedule, currentTime) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  const nowMins = toMinutes(currentTime)
  const sorted = schedule
    .filter((s) => typeof s?.time === 'string')
    .slice()
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))

  let active = null
  for (const slot of sorted) {
    if (toMinutes(slot.time) <= nowMins) active = slot
  }
  return active || sorted[sorted.length - 1] || null
}

module.exports = {
  randomRange,
  randomFrom,
  weightedRandom,
  createSeededRandom,
  generateNPCName,
  getSentimentForInteraction,
  getSentimentLabel,
  getCurrentScheduleSlot,
  formatTime,
}
