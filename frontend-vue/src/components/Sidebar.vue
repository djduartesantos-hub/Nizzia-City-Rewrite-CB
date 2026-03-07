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
        <div class="hero-bar" v-for="bar in heroBars" :key="bar.label">
          <div class="hero-bar__label">{{ bar.label }} · {{ bar.value }}</div>
          <div class="progress-bar hero-track">
            <div class="progress-fill" :class="bar.class" :style="{ width: bar.fill + '%' }"></div>
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
          <span>{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>

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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import api from '../api/client'
import { usePlayer } from '../composables/usePlayer'
import { useToast } from '../composables/useToast'
import { fmtMoney, fmtDuration } from '../utils/format'

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

const heroBars = computed(() => [
  { label: 'Energy', value: `${eNow.value}/${eMax.value}`, fill: pct(eNow.value, eMax.value), class: 'energy' },
  { label: 'Nerve', value: `${nNow.value}/${nMax.value}`, fill: pct(nNow.value, nMax.value), class: 'nerve' },
  { label: 'Happy', value: `${hNow.value}/${hMax.value}`, fill: pct(hNow.value, hMax.value), class: 'happy' },
  { label: 'HP', value: `${hpNow.value}/${hpMax}`, fill: pct(hpNow.value, hpMax), class: 'life' }
])

function pct(cur, max){ return max > 0 ? Math.min(100, Math.round((cur/max)*100)) : 0 }

// ── Live clock for cooldown countdowns ──
const now = ref(Date.now())
let timerId
onMounted(() => { timerId = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { clearInterval(timerId) })

// ── Extra sidebar data ──
const bankUnlockAt = ref(null)
const cartelRank = ref(null)
const hasWarehouse = ref(false)
const hasBusiness = ref(false)
const hasCartel = computed(() => !!cartelRank.value)
const hasStocks = computed(() => (store.player?.portfolio || []).some(p => Number(p?.shares || 0) > 0))

const navItems = computed(() => {
  const base = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/inventory', label: 'Inventory', icon: '🎒' },
    { to: '/city', label: 'City', icon: '🌆' },
    { to: '/job', label: 'Job', icon: '💼' },
    { to: '/education', label: 'Education', icon: '📚' },
    { to: '/gym', label: 'Gym', icon: '💪' },
    { to: '/casino', label: 'Casino', icon: '🎰' },
    { to: '/stocks', label: 'Stocks', icon: '📈' },
    { to: '/crimes', label: 'Crimes', icon: '⚠️' },
    { to: '/money', label: 'Money', icon: '💰' },
    { to: '/property', label: 'Property', icon: '🏢' },
    { to: '/pets', label: 'Pets', icon: '🐾' },
    { to: '/market', label: 'Market', icon: '🛒' },
    { to: '/vault', label: 'Vault', icon: '🔐' }
  ]

  const extended = [
    { to: '/grow', label: 'Grow Operation', icon: '🌿', show: hasWarehouse.value },
    { to: '/real-estate?tab=businesses', label: 'Business', icon: '🏭', show: hasBusiness.value },
    { to: '/cartel', label: 'Drug Empire', icon: '🧪', show: hasCartel.value }
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
