<template>
  <aside class="sidebar">
    <div class="sidebar-hero">
      <div class="hero-meta">
        <span class="hero-chip">{{ store.player?.playerRole || 'Citizen' }}</span>
        <span class="hero-chip hero-chip--accent">Lvl {{ store.player?.level || 1 }}</span>
      </div>
      <h2>{{ store.player?.name || 'Newcomer' }}</h2>
      <p class="hero-balance">{{ money }}</p>
      <div class="hero-bars">
        <div
          class="hero-bar"
          v-for="bar in heroBars"
          :key="bar.label"
          :class="{ 'has-tooltip': bar.tooltip }"
          :data-tip="bar.tooltip || null"
        >
          <div class="hero-bar__label">
            <span class="hero-label-text">{{ bar.label }}: {{ bar.value }}</span>
            <span class="hero-timer">{{ bar.timerLabel }}</span>
          </div>
          <div class="progress-bar hero-track">
            <div class="tick-grid"></div>
            <div class="progress-fill" :class="bar.class" :style="{ width: bar.fill + '%' }"></div>
            <div v-if="bar.regen?.ghostWidth" class="progress-ghost" :class="bar.class" :style="{ left: bar.fill + '%', width: bar.regen.ghostWidth + '%' }"></div>
            <div v-if="bar.regen" class="progress-tick" :style="{ width: bar.regen.tickProgress + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="sidebar-grid">
      <div class="fact">
        <p class="label">Points</p>
        <p class="value">{{ store.player?.points ?? 0 }}</p>
      </div>
      <div class="fact">
        <p class="label">Player ID</p>
        <p class="value">#{{ store.player?.id ?? '—' }}</p>
      </div>
      <div class="fact">
        <p class="label">Job</p>
        <p class="value">{{ store.player?.job?.title || 'Unassigned' }}</p>
      </div>
    </div>

    <div class="status-effects" v-if="effects.length">
      <span
        v-for="(e, i) in effects"
        :key="i"
        class="effect-icon"
        :data-tip="e.title"
        :title="e.title"
        role="img"
        :aria-label="e.title"
      >{{ e.symbol }}</span>
    </div>

    <ul class="nav-list">
      <li v-for="item in navItems" :key="item.to">
        <RouterLink :to="item.to">
          <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
          <div class="nav-text">
            <span class="nav-label">{{ item.label }}</span>
            <small class="nav-desc">{{ item.desc }}</small>
          </div>
          <span class="nav-arrow" aria-hidden="true">→</span>
        </RouterLink>
      </li>
    </ul>

    <div class="sidebar-poster">
      <div class="poster-art" aria-hidden="true"></div>
      <div class="poster-copy">
        <p class="poster-kicker">City spotlight</p>
        <h3>Skyline Parade</h3>
        <p>Night markets, cartel intel e missões especiais em destaque esta semana.</p>
        <button class="btn btn--primary" @click="openSpotlight">Ver agenda</button>
      </div>
    </div>

    <div id="dev-menu" class="info u-mt-16" v-show="isDev">
      <h3>Developer</h3>
      <div class="u-mb-8">
        <label>Add Money</label>
        <div class="u-flex u-gap-6">
          <input v-model.number="devMoney" type="number" />
          <button @click="doDev('add-money', devMoney)" class="btn">Add</button>
        </div>
      </div>
      <div class="u-mb-8">
        <label>Add Energy</label>
        <div class="u-flex u-gap-6">
          <input v-model.number="devEnergy" type="number" />
          <button @click="doDev('add-energy', devEnergy)" class="btn">Add</button>
        </div>
      </div>
      <div>
        <label>Add Nerve</label>
        <div class="u-flex u-gap-6">
          <input v-model.number="devNerve" type="number" />
          <button @click="doDev('add-nerve', devNerve)" class="btn">Add</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import api from '../api/client'
import { usePlayer } from '../composables/usePlayer'
import { useToast } from '../composables/useToast'
import { fmtMoney, fmtDuration, fmtHms } from '../utils/format'

const { store, ensurePlayer } = usePlayer()
const toast = useToast()
const router = useRouter()

const eNow = computed(() => store.player?.energyStats?.energy ?? 0)
const eMax = computed(() => store.player?.energyStats?.energyMax ?? 0)
const nNow = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const hNow = computed(() => store.player?.happiness?.happy ?? 0)
const hMax = computed(() => store.player?.happiness?.happyMax ?? 0)
const hpNow = computed(() => typeof store.player?.health === 'number' ? store.player.health : 0)
const hpMax = 100
const money = computed(() => fmtMoney(store.player?.money || 0))

const isDev = computed(() => store.player?.playerRole === 'Developer')

const devMoney = ref(100000)
const devEnergy = ref(10)
const devNerve = ref(5)

const regenConfig = {
  energy: { interval: 600, amount: 5 },
  nerve: { interval: 300, amount: 1 },
  happy: { interval: 300, amount: 5 },
}

const regenBindings = {
  energy: { path: 'energyStats', valueKey: 'energy', maxKey: 'energyMax' },
  nerve: { path: 'nerveStats', valueKey: 'nerve', maxKey: 'nerveMax' },
  happy: { path: 'happiness', valueKey: 'happy', maxKey: 'happyMax' },
}

const regenState = reactive({
  energy: createRegenTracker(),
  nerve: createRegenTracker(),
  happy: createRegenTracker(),
})

const heroBars = computed(() => [
  buildBar('Energy', 'energy', eNow.value, eMax.value, 'energy', regenConfig.energy),
  buildBar('Nerve', 'nerve', nNow.value, nMax.value, 'nerve', regenConfig.nerve),
  buildBar('Happy', 'happy', hNow.value, hMax.value, 'happy', regenConfig.happy),
  buildBar('Life', 'life', hpNow.value, hpMax, 'life', null)
])

watch([eNow, eMax], ([value, max]) => syncRegenState('energy', value, max), { immediate: true })
watch([nNow, nMax], ([value, max]) => syncRegenState('nerve', value, max), { immediate: true })
watch([hNow, hMax], ([value, max]) => syncRegenState('happy', value, max), { immediate: true })

function pct(cur, max){ return max > 0 ? Math.min(100, Math.round((cur/max)*100)) : 0 }

function buildBar(label, statKey, current, max, cls, regen) {
  const tracker = statKey && regenState[statKey]
  const safeMax = Math.max(0, tracker?.max || max)
  const baseCurrent = tracker ? tracker.value : current
  const displayCurrent = Math.min(baseCurrent, safeMax)
  const fill = pct(displayCurrent, safeMax)
  if (!regen || safeMax <= 0) {
    return {
      label,
      value: `${displayCurrent}/${safeMax}`,
      fill,
      class: cls,
      timerLabel: displayCurrent >= safeMax ? 'FULL' : '—',
    }
  }
  const secondsLeft = secondsUntilTick(regen.interval)
  const pendingGain = Math.min(regen.amount || 0, Math.max(0, safeMax - displayCurrent))
  const ghostWidth = safeMax ? (pendingGain / safeMax) * 100 : 0
  const tickProgress = regen.interval ? Math.max(0, Math.min(100, ((regen.interval - secondsLeft) / regen.interval) * 100)) : 0
  const tooltip = buildTooltip(label, displayCurrent, safeMax, regen)
  return {
    label,
    value: `${displayCurrent}/${safeMax}`,
    fill,
    class: cls,
    timerLabel: formatTimerLabel(displayCurrent, safeMax, secondsLeft),
    regen: {
      amount: regen.amount,
      timeLabel: fmtMmSs(secondsLeft),
      interval: regen.interval,
      ghostWidth,
      tickProgress,
    },
    tooltip,
  }
}

function createRegenTracker() {
  return { value: 0, max: 0, prevSeconds: null }
}

function syncRegenState(statKey, value, max) {
  const tracker = regenState[statKey]
  if (!tracker) return
  tracker.value = Number(value) || 0
  tracker.max = Number(max) || 0
  tracker.prevSeconds = null
}

function processRegenTicks(initial = false) {
  for (const key of Object.keys(regenConfig)) {
    const cfg = regenConfig[key]
    const tracker = regenState[key]
    if (!cfg || !tracker || !cfg.interval) continue
    const secondsLeft = secondsUntilTick(cfg.interval)
    if (initial || tracker.prevSeconds === null) {
      tracker.prevSeconds = secondsLeft
      continue
    }
    const wrapped = secondsLeft > tracker.prevSeconds
    tracker.prevSeconds = secondsLeft
    if (!wrapped) continue
    applyRegenGain(key, cfg.amount)
  }
}

function applyRegenGain(statKey, amount) {
  if (!amount || amount <= 0) return
  const tracker = regenState[statKey]
  if (!tracker || tracker.max <= 0) return
  const next = Math.min(tracker.max, Number(tracker.value || 0) + amount)
  if (next === tracker.value) return
  tracker.value = next
  const binding = regenBindings[statKey]
  if (!binding) return
  const payload = {
    [binding.path]: {
      [binding.valueKey]: next,
    },
  }
  store.mergePartial(payload)
}

function fmtMmSs(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatTimerLabel(current, max, secondsLeft) {
  if (current >= max) return 'FULL'
  return fmtMmSs(secondsLeft)
}

function formatIntervalLabel(seconds) {
  if (!seconds) return '0s'
  if (seconds % 60 === 0) {
    const mins = seconds / 60
    return `${mins} minute${mins === 1 ? '' : 's'}`
  }
  return fmtHms(seconds)
}

function secondsToFull(current, max, amount, interval) {
  const missing = Math.max(0, max - current)
  if (missing === 0 || !amount || amount <= 0 || !interval) return 0
  const ticks = Math.ceil(missing / amount)
  return ticks * interval
}

function buildTooltip(label, current, max, regen) {
  if (!regen) return null
  const lines = []
  lines.push(`${label} increases by ${regen.amount} every ${formatIntervalLabel(regen.interval)}`)
  const fullSeconds = secondsToFull(current, max, regen.amount, regen.interval)
  if (current >= max || fullSeconds === 0) {
    lines.push(`${label} is full`)
  } else {
    lines.push(`Full ${label.toLowerCase()} in ${fmtHms(fullSeconds)}`)
  }
  return lines.join('\n')
}

// ── Live clock for cooldown countdowns ──
const now = ref(Date.now())
let timerId
onMounted(() => {
  processRegenTicks(true)
  timerId = setInterval(() => {
    now.value = Date.now()
    processRegenTicks()
  }, 1000)
})
onUnmounted(() => { clearInterval(timerId) })

function secondsUntilTick(intervalSeconds) {
  if (!intervalSeconds) return 0
  const secondsToday = Math.floor(now.value / 1000)
  const remainder = secondsToday % intervalSeconds
  return remainder === 0 ? intervalSeconds : intervalSeconds - remainder
}

// ── Extra sidebar data ──
const bankUnlockAt = ref(null)
const cartelRank = ref(null)
const hasWarehouse = ref(false)
const hasBusiness = ref(false)
const hasCartel = computed(() => !!cartelRank.value)
const hasStocks = computed(() => (store.player?.portfolio || []).some(p => Number(p?.shares || 0) > 0))

const navItems = computed(() => {
  const base = [
    { to: '/', label: 'HQ', desc: 'Painel geral', icon: '🏠' },
    { to: '/inventory', label: 'Inventário', desc: 'Gear & drops', icon: '🎒' },
    { to: '/city', label: 'Cidade', desc: 'Distritos e eventos', icon: '🌆' },
    { to: '/job', label: 'Emprego', desc: 'Contratos oficiais', icon: '💼' },
    { to: '/education', label: 'Educação', desc: 'Cursos & perks', icon: '📚' },
    { to: '/gym', label: 'Ginásio', desc: 'Stats & treino', icon: '💪' },
    { to: '/casino', label: 'Cassino', desc: 'Luck & jackpots', icon: '🎰' },
    { to: '/stocks', label: 'Bolsa', desc: 'Mercado & holdings', icon: '📈' },
    { to: '/crimes', label: 'Crimes', desc: 'Operações rápidas', icon: '⚠️' },
    { to: '/money', label: 'Finanças', desc: 'Fluxo de cash', icon: '💰' },
    { to: '/property', label: 'Propriedades', desc: 'Bases & upgrades', icon: '🏢' },
    { to: '/pets', label: 'Companheiros', desc: 'Pets & buffs', icon: '🐾' },
    { to: '/market', label: 'Mercado', desc: 'Leilões & troca', icon: '🛒' },
    { to: '/vault', label: 'Cofre', desc: 'Segurança máxima', icon: '🔐' }
  ]

  const extended = [
    { to: '/grow', label: 'Grow Ops', desc: 'Laboratórios & colheitas', icon: '🌿', show: hasWarehouse.value },
    { to: '/real-estate?tab=businesses', label: 'Negócios', desc: 'Império corporativo', icon: '🏭', show: hasBusiness.value },
    { to: '/cartel', label: 'Cartel', desc: 'Reputação & conselhos', icon: '🧪', show: hasCartel.value }
  ]

  return base
    .concat(extended)
    .filter(item => (typeof item.show === 'boolean' ? item.show : true))
})

async function loadBank() {
  try {
    const { data } = await api.get('/bank/accounts')
    const active = (data?.accounts || []).filter(a => !a.isWithdrawn && new Date(a.endDate) > new Date())
    if (active.length) {
      active.sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
      bankUnlockAt.value = new Date(active[0].endDate)
    }
  } catch { /* sidebar enrichment - non-critical */ }
}

async function loadCartel() {
  try {
    const { data } = await api.get('/cartel/overview')
    cartelRank.value = data?.cartel?.repInfo?.name || (data?.cartel?.name ? 'Nobody' : null)
  } catch { cartelRank.value = null }
}

async function loadGrowState() {
  try {
    const { data } = await api.get('/grow/my')
    hasWarehouse.value = !!data?.warehouse
  } catch { hasWarehouse.value = false }
}

async function loadBusinessState() {
  try {
    const { data } = await api.get('/business/my')
    hasBusiness.value = (data?.businesses || []).length > 0
  } catch { hasBusiness.value = false }
}

// ── Status effects (icons with tooltips) ──
function fmtDur(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '0s'
  return fmtDuration(sec * 1000)
}

const effects = computed(() => {
  const arr = []
  const p = store.player
  if (!p) return arr

  // Gender
  const g = p.gender
  if (g === 'Male')        arr.push({ symbol: '♂', title: 'Male' })
  else if (g === 'Female') arr.push({ symbol: '♀', title: 'Female' })
  else if (g === 'Enby')   arr.push({ symbol: '⚧', title: 'Non-binary' })

  // Cooldowns
  const cds = p.cooldowns || {}
  if (Number(cds.medicalCooldown || 0) > 0)
    arr.push({ symbol: '🩹', title: `Medical cooldown • ${fmtDur(cds.medicalCooldown)}` })

  // Drug cooldowns
  const drugMap = cds.drugs || {}
  let drugCount = 0, maxDrug = 0
  for (const k in drugMap) {
    const n = Number(drugMap[k] || 0)
    if (n > 0) { drugCount++; maxDrug = Math.max(maxDrug, n) }
  }
  const legacyDrug = Number(cds.drugCooldown || 0)
  if (legacyDrug > 0) { drugCount = Math.max(drugCount, 1); maxDrug = Math.max(maxDrug, legacyDrug) }
  if (drugCount > 0)
    arr.push({ symbol: '💊', title: `Drug cooldowns • ${drugCount} active • longest ${fmtDur(maxDrug)}` })

  if (Number(cds.alcoholCooldown || 0) > 0) arr.push({ symbol: '🍺', title: `Alcohol cooldown • ${fmtDur(cds.alcoholCooldown)}` })
  if (Number(cds.boosterCooldown || 0) > 0) arr.push({ symbol: '⚡', title: `Booster active • ${fmtDur(cds.boosterCooldown)}` })
  if (hasStocks.value) arr.push({ symbol: '📈', title: 'Stock holdings present' })

  if (bankUnlockAt.value) {
    const remainSec = Math.max(0, Math.floor((bankUnlockAt.value.getTime() - now.value) / 1000))
    arr.push({ symbol: '🏦', title: `Bank unlocks in • ${fmtDur(remainSec)}` })
  }

  const edu = p.education?.active
  if (edu?.courseId) {
    const endsAt = edu.endsAt ? new Date(edu.endsAt) : null
    const remainEdu = endsAt ? Math.max(0, Math.floor((endsAt.getTime() - now.value) / 1000)) : 0
    const done = endsAt && endsAt.getTime() <= now.value
    arr.push({ symbol: '📖', title: done ? 'Course ready to complete!' : `Studying • ${fmtDur(remainEdu)} remaining` })
  }

  if (p.job?.jobId || p.job?.companyId) arr.push({ symbol: '💼', title: p.job?.companyId ? 'Employed (Company)' : 'Employed (City Job)' })
  if (cartelRank.value) arr.push({ symbol: '🧪', title: cartelRank.value })
  if (p.subscriber) arr.push({ symbol: '⭐', title: 'Subscriber' })
  return arr
})

// ── Init ──
onMounted(async () => {
  try {
    await ensurePlayer()
  } catch (e) {
    if (e?.response?.status === 404) { router.push('/auth/create-player'); return }
  }
  await Promise.all([loadBank(), loadCartel(), loadGrowState(), loadBusinessState()])
})

// ── Dev tools ──
async function doDev(path, amount) {
  try {
    await api.post(`/dev/${path}`, { amount: Number(amount) })
    await store.loadByUser()
    toast.ok('Done')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Error')
  }
}

function openSpotlight() {
  router.push('/news')
}
</script>

<style scoped>
.status-effects { display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap; }
.effect-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px; height: 24px;
  border-radius: 2px;
  border: 1px solid var(--border);
  background: var(--bg-alt);
  font-size: 13px;
  cursor: default;
}
.hero-bar__label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}
.regen-chip {
  font-size: 11px;
  color: var(--accent-secondary);
  font-weight: 600;
}
.hero-track {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  position: relative;
}
.progress-fill {
  position: absolute;
}
.hero-bar.has-tooltip { position: relative; }
.hero-bar.has-tooltip::after {
  content: attr(data-tip);
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  white-space: pre-line;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 11px;
  min-width: 160px;
  max-width: 220px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 80ms ease;
  z-index: 4000;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
}
.hero-bar.has-tooltip:hover::after { opacity: 1; }
.effect-icon::after {
  content: attr(data-tip);
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  white-space: normal;
  overflow-wrap: break-word;
  min-width: 140px;
  max-width: min(240px, 80vw);
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 2px;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.4;
  opacity: 0;
  pointer-events: none;
  transition: opacity 80ms;
  z-index: 1000;
}
.effect-icon:hover::after { opacity: 1; }
</style>
