<template>
  <section class="home-page">
    <div class="home-hero">
      <div class="hero-info">
        <p class="hero-kicker">{{ playerBadge }}</p>
        <h1>Bem-vindo de volta, {{ playerName }}</h1>
        <p class="hero-subtitle">{{ heroSubtitle }}</p>
        <div class="hero-meta">
          <div class="hero-meta__item">
            <span class="hero-meta__label">Carteira</span>
            <span class="hero-meta__value">{{ money }}</span>
          </div>
          <div class="hero-meta__item">
            <span class="hero-meta__label">Pontos</span>
            <span class="hero-meta__value">{{ store.player?.points ?? 0 }}</span>
          </div>
          <div class="hero-meta__item">
            <span class="hero-meta__label">Emprego</span>
            <span class="hero-meta__value">{{ jobLabel }}</span>
          </div>
        </div>
        <div class="hero-actions">
          <RouterLink class="btn btn--primary hero-btn" to="/crimes">Continuar crimes</RouterLink>
          <RouterLink class="hero-btn hero-btn--ghost" to="/city">Explorar cidade</RouterLink>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat" v-for="stat in quickStats" :key="stat.label">
          <div class="hero-stat__label">{{ stat.label }}</div>
          <div class="hero-stat__value">{{ stat.value }}</div>
          <div class="hero-stat__bar">
            <span :class="stat.accent" :style="{ width: stat.percent + '%' }"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="home-body">
      <div class="home-column home-column--main">
        <div class="home-card quick-actions-card">
          <div class="card-header">
            <h3>Movimentos rápidos</h3>
            <small>Escolha o próximo passo</small>
          </div>
          <div class="quick-actions__grid">
            <RouterLink v-for="action in quickActions" :key="action.to" :to="action.to" class="quick-action">
              <div class="quick-action__icon">{{ action.icon }}</div>
              <div>
                <div class="quick-action__label">{{ action.label }}</div>
                <div class="quick-action__desc">{{ action.desc }}</div>
              </div>
            </RouterLink>
          </div>
        </div>

        <div class="home-card property-panel">
          <div class="card-header">
            <h3>Propriedade atual</h3>
            <small v-if="home?.name">Felicidade {{ home?.happy }} / {{ home?.happyMax }}</small>
          </div>
          <div v-if="homeLoading" class="property-panel__state">A sincronizar com o imobiliário…</div>
          <div v-else-if="homeError" class="property-panel__state property-panel__state--error">{{ homeError }}</div>
          <div v-else class="property-card">
            <div class="property-card__media">
              <img
                v-if="imageOk && home?.image"
                :src="home.image"
                :alt="home?.name || 'Home'"
                @error="imageOk = false"
              />
              <div v-else class="property-card__placeholder">
                <span>{{ home?.name || home?.id || 'Home' }}</span>
              </div>
            </div>
            <div class="property-card__info">
              <div class="property-card__row">
                <strong class="property-card__name">{{ home?.name || 'Sem residência' }}</strong>
                <span class="property-card__meta">Capacidade {{ home?.slots || 0 }} slots</span>
              </div>
              <div class="property-card__upgrades">
                <div class="property-card__upgrades-title">Upgrades instalados</div>
                <div class="property-card__chips" v-if="installedUpgrades.length">
                  <span class="chip chip--ok" v-for="u in installedUpgrades" :key="u.id">{{ u.name }}</span>
                </div>
                <div v-else class="property-card__empty">Sem upgrades ativos</div>
              </div>
              <div class="property-card__actions">
                <RouterLink to="/property" class="btn btn--primary">Gerir propriedade</RouterLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="home-column home-column--side">
        <div class="home-card summary-card">
          <div class="card-header">
            <h3>Leitura rápida</h3>
            <small>Perfil do agente</small>
          </div>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-label">Nível</span>
              <span class="summary-value">{{ store.player?.level || 1 }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Rank</span>
              <span class="summary-value">{{ store.player?.playerRole || 'Citizen' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Job</span>
              <span class="summary-value">{{ jobLabel }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Residência</span>
              <span class="summary-value">{{ home?.name || '—' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Cartel</span>
              <span class="summary-value">{{ cartelLabel }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Pontos</span>
              <span class="summary-value">{{ store.player?.points ?? 0 }}</span>
            </div>
          </div>
        </div>

        <div class="home-card intel-card">
          <div class="card-header">
            <h3>Intel da cidade</h3>
            <small>Status dos teus pilares</small>
          </div>
          <ul class="intel-list">
            <li v-for="intel in cityIntel" :key="intel.label">
              <div class="intel-label">{{ intel.label }}</div>
              <div class="intel-value">{{ intel.value }}</div>
              <div class="intel-note">{{ intel.note }}</div>
            </li>
          </ul>
        </div>

        <div class="home-card ops-card">
          <div class="card-header">
            <h3>Operações diárias</h3>
            <small>Recursos vitais</small>
          </div>
          <ul class="ops-list">
            <li v-for="op in opsChecklist" :key="op.label">
              <div>
                <div class="ops-label">{{ op.label }}</div>
                <div class="ops-value">{{ op.value }}</div>
              </div>
              <span class="ops-chip" :class="`ops-chip--${op.tone}`">{{ op.status }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { usePlayer } from '../composables/usePlayer'
import { fmtMoney } from '../utils/format'
import api from '../api/client'

const { store, ensurePlayer } = usePlayer()
const money = computed(() => fmtMoney(store.player?.money || 0))
const eNow = computed(() => store.player?.energyStats?.energy ?? 0)
const eMax = computed(() => store.player?.energyStats?.energyMax ?? 0)
const nNow = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const hNow = computed(() => store.player?.happiness?.happy ?? 0)
const hMax = computed(() => store.player?.happiness?.happyMax ?? 0)
const hpNow = computed(() => typeof store.player?.health === 'number' ? store.player.health : 0)
const hpMax = 100
const jobLabel = computed(() => store.player?.job?.title || 'Sem emprego')
const playerName = computed(() => store.player?.name || 'Agente')
const playerBadge = computed(() => `${store.player?.playerRole || 'Citizen'} • Lvl ${store.player?.level || 1}`)
const heroSubtitle = computed(() => {
  const job = jobLabel.value
  return `${job} • Cash em mão ${money.value}`
})
const cartelLabel = computed(() => store.player?.cartel?.name || store.player?.cartelRank || 'Sem cartel')

// Property (Home) panel state
const home = ref(null)
const homeLoading = ref(false)
const homeError = ref('')
const imageOk = ref(true)

function humanizeUpgradeId(id){
  if (!id) return ''
  return String(id).split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ')
}

const installedUpgrades = computed(() => {
  const up = home.value?.upgrades || {}
  const names = home.value?.upgradeNames || {}
  return Object.entries(up)
    .filter(([, level]) => Number(level || 0) > 0)
    .map(([id]) => ({ id, name: names[id] || humanizeUpgradeId(id) }))
})

async function loadHome() {
  if (!store.player?.user) return
  homeLoading.value = true
  homeError.value = ''
  imageOk.value = true
  try {
    const { data } = await api.get('/realestate/home')
    home.value = data
  } catch (e) {
    homeError.value = e?.response?.data?.error || e?.message || 'Failed to load property'
  } finally {
    homeLoading.value = false
  }
}

onMounted(async () => {
  await ensurePlayer()
  loadHome()
})

// Reload home if player changes (e.g., after actions that affect happiness)
watch(() => store.player?.home, () => loadHome())

const quickActions = [
  { to: '/crimes', label: 'Crimes', desc: 'Operações rápidas e payouts', icon: '⚡' },
  { to: '/gym', label: 'Ginásio', desc: 'Aumenta os teus stats', icon: '💪' },
  { to: '/education', label: 'Educação', desc: 'Cursos & perks permanentes', icon: '📚' },
  { to: '/job', label: 'Emprego', desc: 'Recolher salários e promoções', icon: '💼' },
  { to: '/casino', label: 'Cassino', desc: 'Alto risco, alto retorno', icon: '🎲' },
  { to: '/inventory', label: 'Inventário', desc: 'Equipamento e consumíveis', icon: '🎒' },
]

function percentOf(cur, max) {
  if (!max || max <= 0) return 0
  return Math.min(100, Math.round((cur / max) * 100))
}

const quickStats = computed(() => [
  { label: 'Energy', value: `${eNow.value}/${eMax.value}`, percent: percentOf(eNow.value, eMax.value), accent: 'accent-energy' },
  { label: 'Nerve', value: `${nNow.value}/${nMax.value}`, percent: percentOf(nNow.value, nMax.value), accent: 'accent-nerve' },
  { label: 'Happy', value: `${hNow.value}/${hMax.value}`, percent: percentOf(hNow.value, hMax.value), accent: 'accent-happy' },
  { label: 'Life', value: `${hpNow.value}/${hpMax}`, percent: percentOf(hpNow.value, hpMax), accent: 'accent-life' },
])

const cityIntel = computed(() => {
  const intel = []
  intel.push({
    label: 'Residência',
    value: home.value?.name || 'Sem base definida',
    note: home.value ? `${installedUpgrades.value.length} upgrade(s) ativos` : 'Compra uma propriedade em Real Estate',
  })
  intel.push({
    label: 'Emprego',
    value: jobLabel.value,
    note: jobLabel.value === 'Sem emprego' ? 'Visita /job para começar a trabalhar' : 'Mantém a rotina para subir de cargo',
  })
  const edu = store.player?.education?.active
  intel.push({
    label: 'Curso',
    value: edu?.courseName || edu?.courseId || 'Nenhum',
    note: edu ? etaLabel(edu.endsAt) : 'Matricula-te em Educação',
  })
  intel.push({
    label: 'Cartel',
    value: cartelLabel.value,
    note: cartelLabel.value === 'Sem cartel' ? 'Sobe reputação para desbloquear conselhos' : 'Contribui para ganhar perks',
  })
  return intel
})

const opsChecklist = computed(() => [
  buildOp('Energia', eNow.value, eMax.value),
  buildOp('Nerve', nNow.value, nMax.value),
  buildOp('Felicidade', hNow.value, hMax.value),
  buildOp('HP', hpNow.value, hpMax),
])

function buildOp(label, current, max) {
  return {
    label,
    value: `${current}/${max}`,
    status: statusLabel(current, max),
    tone: statusTone(current, max),
  }
}

function statusLabel(current, max) {
  if (!max || max <= 0) return '—'
  if (current >= max) return 'Pronto'
  if (current === 0) return 'Esgotado'
  return 'A regenerar'
}

function statusTone(current, max) {
  if (!max || max <= 0) return 'muted'
  const ratio = current / max
  if (ratio < 0.25) return 'alert'
  if (ratio < 0.8) return 'warn'
  return 'ok'
}

function etaLabel(dateString) {
  if (!dateString) return 'Pronto para iniciar'
  const target = new Date(dateString).getTime()
  if (Number.isNaN(target)) return 'Em progresso'
  const diff = target - Date.now()
  if (diff <= 0) return 'Pronto para finalizar'
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `Completo em ${hours}h ${minutes % 60}m`
  return `Completo em ${Math.max(minutes, 1)}m`
}
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.home-hero {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  background: radial-gradient(circle at top left, rgba(146, 98, 255, 0.28), rgba(9, 12, 28, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  padding: 28px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
}

.hero-info {
  flex: 1 1 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-kicker {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
}

.hero-subtitle {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.hero-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-meta__item {
  min-width: 140px;
  padding-left: 10px;
  border-left: 2px solid rgba(255, 255, 255, 0.25);
}

.hero-meta__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.6);
}

.hero-meta__value {
  display: block;
  font-size: 18px;
  font-weight: 600;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.hero-btn {
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 600;
}

.hero-btn--ghost {
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-stats {
  flex: 1 1 260px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.hero-stat {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
}

.hero-stat__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.65);
}

.hero-stat__value {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

.hero-stat__bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  overflow: hidden;
}

.hero-stat__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.accent-energy { background: linear-gradient(90deg, #46ffe1, #00d4ff); }
.accent-nerve { background: linear-gradient(90deg, #ff6b6b, #f72585); }
.accent-happy { background: linear-gradient(90deg, #ffd166, #ffb347); }
.accent-life { background: linear-gradient(90deg, #8b83ff, #6366f1); }

.home-body {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.home-column {
  flex: 1 1 320px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.home-column--side {
  flex: 0 0 320px;
  max-width: 360px;
}

.home-card {
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 13px;
}

.card-header small {
  color: var(--muted);
  font-size: 11px;
}

.quick-actions__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.quick-action {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms, transform 120ms;
}

.quick-action:hover {
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

.quick-action__icon {
  font-size: 20px;
}

.quick-action__label { font-weight: 600; }
.quick-action__desc { font-size: 12px; color: var(--muted); }

.property-panel__state {
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 13px;
  color: var(--muted);
}

.property-panel__state--error { color: #ff7676; border: 1px solid rgba(255, 118, 118, 0.4); }

.property-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.property-card__media {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.property-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.property-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--muted);
}

.property-card__info { display: flex; flex-direction: column; gap: 10px; }
.property-card__row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; }
.property-card__name { font-size: 16px; font-weight: 600; }
.property-card__meta { font-size: 12px; color: var(--muted); }
.property-card__upgrades-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.property-card__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.property-card__empty { font-size: 12px; color: var(--muted); }
.property-card__actions { margin-top: 4px; }

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-item {
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
}

.summary-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.summary-value {
  font-size: 15px;
  font-weight: 600;
}

.intel-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intel-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.intel-value { font-size: 15px; font-weight: 600; }
.intel-note { font-size: 12px; color: var(--muted); }

.ops-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ops-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.ops-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.ops-value { font-size: 15px; font-weight: 600; }

.ops-chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ops-chip--ok { background: rgba(76, 217, 140, 0.15); color: #4cd990; }
.ops-chip--warn { background: rgba(255, 214, 102, 0.2); color: #ffd166; }
.ops-chip--alert { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
.ops-chip--muted { background: rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.6); }

@media (max-width: 900px) {
  .home-column--side {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
