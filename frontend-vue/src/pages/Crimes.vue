<template>
  <section class="crimes-page">
    <div class="crime-hero">
      <div class="crime-hero__text">
        <p class="eyebrow">Operações clandestinas</p>
        <h1>Crimes &amp; Oportunidades</h1>
        <p class="muted">Escolhe a tua jogada. Cada missão consome <strong>nerve</strong>, escala notoriedade e desbloqueia intel única para futuros golpes.</p>
        <div class="hero-meta">
          <div class="hero-meta__item">
            <span class="label">Nerve</span>
            <span class="value">{{ nerve }}/{{ nerveMax }}</span>
          </div>
          <div class="hero-meta__item">
            <span class="label">Dinheiro</span>
            <span class="value">{{ money }}</span>
          </div>
          <div class="hero-meta__item">
            <span class="label">Heat</span>
            <span class="value heat">{{ heat }}%</span>
          </div>
        </div>
        <div class="hero-actions">
          <button class="btn btn--primary" @click="openSearchForCash">Briefing imediato</button>
          <button class="btn btn--ghost" @click="openIntel">Ver histórico</button>
        </div>
      </div>
      <div class="crime-hero__viz">
        <div class="map-glow">
          <div class="pulse one"></div>
          <div class="pulse two"></div>
          <div class="pulse three"></div>
        </div>
        <ul class="intel-list">
          <li v-for="op in intel" :key="op.title">
            <span class="intel-dot" :style="{ background: op.color }"></span>
            <div>
              <p class="intel-title">{{ op.title }}</p>
              <p class="intel-meta">{{ op.meta }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="catalog-state" v-if="catalogLoading">
      <div class="spinner"></div>
      <p>Carregando operações clandestinas…</p>
    </div>
    <div class="catalog-state error" v-else-if="catalogError">
      <p>{{ catalogError }}</p>
      <button class="btn btn--ghost" @click="loadCrimeCatalog">Tentar novamente</button>
    </div>
    <div class="catalog-state" v-else-if="!crimes.length">
      <p>Nenhum crime disponível no momento. Volta mais tarde.</p>
    </div>
    <div class="crime-grid" v-else>
      <article
        v-for="crime in crimes"
        :key="crime.id"
        class="crime-card"
        :class="[`crime-card--${crime.status}`]">
        <div class="crime-card__head">
          <span class="crime-icon" aria-hidden="true">{{ crime.icon }}</span>
          <div>
            <p class="crime-label">{{ crime.tag }}</p>
            <h3>{{ crime.title }}</h3>
          </div>
          <span class="status-chip" :class="`status-chip--${crime.status}`">{{ statusCopy[crime.status] }}</span>
        </div>
        <p class="crime-desc">{{ crime.desc }}</p>
        <div class="crime-meta">
          <div>
            <span class="label">Dificuldade</span>
            <strong>{{ crime.difficulty }}</strong>
          </div>
          <div>
            <span class="label">Nerve</span>
            <strong>{{ crime.nerveCost }}</strong>
          </div>
          <div>
            <span class="label">Cooldown</span>
            <strong>{{ crime.cooldown }}</strong>
          </div>
        </div>
        <button
          class="btn crime-card__btn"
          :class="{ 'btn--primary': crime.status === 'available' }"
          :disabled="crime.status !== 'available'"
          @click="jump(crime)">
          {{ crime.status === 'available' ? 'Iniciar' : crime.cta }}
        </button>
      </article>
    </div>

    <div class="crime-foot">
      <div class="timeline">
        <p class="eyebrow">Próximos desbloqueios</p>
        <ul>
          <li v-for="unlock in unlocks" :key="unlock.title">
            <span class="timeline-date">{{ unlock.date }}</span>
            <div>
              <p class="timeline-title">{{ unlock.title }}</p>
              <p class="timeline-desc">{{ unlock.desc }}</p>
            </div>
          </li>
        </ul>
      </div>
      <div class="tip">
        <h4>Dica</h4>
        <p>Aumenta a <strong>happiness</strong> antes dos crimes para multiplicar recompensas e reduz a hipótese de falhanço.</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../composables/usePlayer'
import api from '../api/client'
import { fmtMoney } from '../utils/format'

const router = useRouter()
const { store, ensurePlayer } = usePlayer()

const catalog = ref([])
const catalogLoading = ref(false)
const catalogError = ref('')

onMounted(async () => {
  await Promise.all([ensurePlayer(), loadCrimeCatalog()])
})

const nerve = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nerveMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const heat = computed(() => store.player?.heat ?? 12)
const money = computed(() => fmtMoney(store.player?.money || 0))

const routeMap = {
  search_for_cash: { name: 'crime-search-for-cash' },
  pickpocket: { name: 'crime-pickpocket' },
  burglary: { name: 'crime-burglary' },
  smuggling: { name: 'crime-smuggling' },
}

const fallbackCrimes = [
  {
    id: 'search_for_cash',
    title: 'Search for Cash',
    description: 'Revira vielas, cassinos clandestinos e cofres abandonados em busca de notas soltas.',
    difficulty: 'Baixa',
    nerveCost: 2,
    cooldownSeconds: 60,
    icon: '💼',
    tag: 'Street run',
    status: 'available',
    cta: 'Iniciar',
  },
  {
    id: 'pickpocket',
    title: 'Pickpocket',
    description: 'Rondas silenciosas em mercados noturnos. Exige timing perfeito e aliados.',
    difficulty: 'Média',
    nerveCost: 4,
    cooldownSeconds: 180,
    icon: '🧤',
    tag: 'Stealth',
    status: 'available',
    cta: 'Iniciar',
  },
  {
    id: 'burglary',
    title: 'Burglary',
    description: 'Invade apartamentos de alto luxo, dribla sistemas de laser e extrai relíquias.',
    difficulty: 'Alta',
    nerveCost: 7,
    cooldownSeconds: 600,
    icon: '🕵️‍♂️',
    tag: 'Heist',
    status: 'available',
    cta: 'Iniciar',
  },
  {
    id: 'smuggling',
    title: 'Smuggling',
    description: 'Rotas marítimas e drones para contrabando de tech raro. Coordena com o cartel.',
    difficulty: 'Muito alta',
    nerveCost: 10,
    cooldownSeconds: 1800,
    icon: '🚁',
    tag: 'Logistics',
    status: 'available',
    cta: 'Iniciar',
  },
]

const catalogCrimes = computed(() => {
  return (catalog.value || []).map((crime) => formatCrimeForCard(crime))
})

const crimes = computed(() => {
  const list = catalogCrimes.value.length ? catalogCrimes.value : fallbackCrimes.map((crime) => formatCrimeForCard(crime))
  return list
})

const statusCopy = {
  available: 'Disponível',
  soon: 'Em preparação',
  locked: 'Bloqueado'
}

const intel = [
  { title: 'Sector 7A', meta: 'Novos cofres detectados', color: 'rgba(51,255,209,0.9)' },
  { title: 'Docas Eclipse', meta: 'Fluxo suspeito às 02:00', color: 'rgba(249,115,22,0.9)' },
  { title: 'Rede Kronos', meta: 'Firewall vulnerável', color: 'rgba(125,249,198,0.9)' }
]

const unlocks = [
  { date: '18 MAR', title: 'Pickpocket League', desc: 'Ranking global de furtos rápidos.' },
  { date: '02 ABR', title: 'Black Market 2.0', desc: 'Itens exclusivos pós-crime.' },
  { date: '17 ABR', title: 'Smuggling Ops', desc: 'Campanha cooperativa multi-equipa.' }
]

function formatCooldown(seconds) {
  const value = Number(seconds || 0)
  if (value >= 3600) return `${Math.round(value / 3600)}h`
  if (value >= 60) return `${Math.round(value / 60)}m`
  if (value > 0) return `${value}s`
  return 'Instantâneo'
}

function formatCrimeForCard(crime) {
  if (!crime) return null
  const cooldownSeconds = Number(crime.cooldownSeconds ?? 0)
  const nerveCost = crime.nerveCost !== undefined ? crime.nerveCost : '—'
  return {
    id: crime.id,
    title: crime.title || 'Crime Sem Nome',
    desc: crime.description || crime.desc || 'Missão em preparação.',
    difficulty: crime.difficulty || 'Desconhecida',
    nerveCost: String(nerveCost),
    cooldown: formatCooldown(cooldownSeconds),
    icon: crime.icon || '🎯',
    tag: crime.tag || 'Operação',
    status: crime.status || 'soon',
    cta: crime.cta || 'Em breve',
    route: routeMap[crime.id] || null,
  }
}

async function loadCrimeCatalog() {
  if (catalogLoading.value) return
  try {
    catalogLoading.value = true
    const res = await api.get('/crime/catalog')
    catalog.value = res.data?.crimes || []
    catalogError.value = ''
  } catch (err) {
    catalogError.value = err?.response?.data?.error || 'Falha ao carregar crimes'
  } finally {
    catalogLoading.value = false
  }
}

async function openSearchForCash(){
  await router.push({ name: 'crime-search-for-cash' })
}

function openIntel(){
  router.push('/news')
}

function jump(crime){
  if (crime.status !== 'available' || !crime.route) return
  router.push(crime.route)
}
</script>

<style scoped>
.crimes-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.crime-hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  padding: 28px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(14, 20, 40, 0.92), rgba(8, 21, 33, 0.8));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.35);
}
.eyebrow {
  letter-spacing: 0.4em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 6px;
}
.crime-hero__text h1 { font-size: 2rem; margin-bottom: 12px; }
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0;
}
.hero-meta__item {
  padding: 12px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  min-width: 120px;
}
.hero-meta__item .label {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.hero-meta__item .value { font-size: 1.2rem; font-weight: 600; }
.hero-meta__item .heat { color: var(--warn); }
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.crime-hero__viz {
  position: relative;
  border-radius: 24px;
  padding: 24px;
  background: radial-gradient(circle at 30% 20%, rgba(51, 255, 209, 0.25), transparent 60%),
              radial-gradient(circle at 80% 20%, rgba(249, 115, 22, 0.3), transparent 65%),
              rgba(8, 11, 25, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.map-glow {
  position: relative;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(51, 255, 209, 0.6), rgba(51, 255, 209, 0));
  filter: blur(8px);
}
.pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: pulse 5s infinite;
}
.pulse.two { animation-delay: 0.8s; }
.pulse.three { animation-delay: 1.4s; }
@keyframes pulse {
  0% { transform: scale(0.6); opacity: 0.9; }
  70% { transform: scale(1.4); opacity: 0; }
  100% { opacity: 0; }
}
.intel-list {
  list-style: none;
  padding: 0;
  margin: 20px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.intel-list li {
  display: flex;
  gap: 10px;
  align-items: center;
}
.intel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 12px currentColor;
}
.intel-title { font-weight: 600; }
.intel-meta { font-size: 12px; color: var(--muted); }

.crime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
}
.catalog-state {
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  padding: 32px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
}
.catalog-state.error { border-color: rgba(239, 68, 68, 0.3); color: #f87171; }
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent, #33ffd1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.crime-card {
  position: relative;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(7, 9, 22, 0.9);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
}
.crime-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at top right, rgba(51, 255, 209, 0.15), transparent 55%);
  pointer-events: none;
}
.crime-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.crime-icon {
  width: 48px;
  height: 48px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  font-size: 22px;
}
.crime-label {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}
h3 { margin: 2px 0 0; font-size: 1.1rem; }
.status-chip {
  margin-left: auto;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.status-chip--available { background: rgba(51, 255, 209, 0.15); color: var(--accent); }
.status-chip--soon { background: rgba(249, 115, 22, 0.15); color: #f97316; }
.status-chip--locked { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
.crime-desc { color: var(--muted); min-height: 48px; }
.crime-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; }
.crime-meta .label { color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.crime-card__btn { align-self: flex-start; }
.crime-card--available { border-color: rgba(51, 255, 209, 0.35); }
.crime-card--available:hover { transform: translateY(-3px); }

.crime-foot {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  flex-wrap: wrap;
}
.timeline, .tip {
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
  background: rgba(9, 11, 26, 0.85);
}
.timeline ul { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 14px; }
.timeline li { display: flex; gap: 14px; }
.timeline-date { font-weight: 700; color: var(--accent-secondary); width: 70px; }
.timeline-title { font-weight: 600; }
.timeline-desc { font-size: 12px; color: var(--muted); }
.tip h4 { margin-bottom: 8px; }

@media (max-width: 900px) {
  .crime-foot { grid-template-columns: 1fr; }
}
</style>
