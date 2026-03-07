<template>
  <section class="sfc-page">
    <header class="sfc-hero">
      <div>
        <p class="eyebrow">Operação relâmpago</p>
        <h1>Search for Cash</h1>
        <p class="muted">Varre vielas, cofres abandonados e casinos clandestinos à caça de notas esquecidas. Escolhe a zona mais promissora e gere o risco.</p>
      </div>
      <div class="hero-stats">
        <div class="stat-card">
          <span class="label">Money</span>
          <strong>{{ money }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Nerve</span>
          <strong>{{ nerve }}/{{ nerveMax }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Último resultado</span>
          <strong>{{ lastLabel }}</strong>
        </div>
      </div>
    </header>

    <div class="sfc-body">
      <div class="location-board">
        <div class="board-head">
          <h2>Locais monitorizados</h2>
          <p class="muted">Probabilidade baseada em <strong>popularidade</strong> e <strong>heat</strong> recente.</p>
        </div>
        <div class="location-grid">
          <button
            v-for="l in locations"
            :key="l.id"
            class="location-card"
            :class="{ active: l.id===selLoc }"
            @click="selLoc = l.id">
            <div class="location-card__head">
              <div>
                <p class="location-label">{{ l.city || 'Zona' }}</p>
                <h3>{{ l.name }}</h3>
              </div>
              <span class="chance">{{ Math.round((l.popularity || 0) * 100) }}%</span>
            </div>
            <p class="location-desc">{{ l.description || 'Intel em atualização constante.' }}</p>
            <div class="pop">
              <div class="pop__bar" :style="{ width: (Math.round((l.popularity||0)*100)) + '%' }"></div>
            </div>
            <div class="location-meta">
              <span>{{ l.heat ? 'Heat '+l.heat+'%' : 'Heat estável' }}</span>
              <span>{{ l.updatedAt ? formatDate(l.updatedAt) : 'há instantes' }}</span>
            </div>
          </button>
        </div>
      </div>

      <aside class="action-panel">
        <div class="action-panel__body">
          <h2>Briefing rápido</h2>
          <p v-if="currentLocation" class="muted">Destino selecionado: <strong>{{ currentLocation.name }}</strong></p>
          <ul class="action-facts" v-if="currentLocation">
            <li>
              <span>Risk</span>
              <strong>{{ riskLabel }}</strong>
            </li>
            <li>
              <span>Popularidade</span>
              <strong>{{ Math.round((currentLocation.popularity || 0) * 100) }}%</strong>
            </li>
            <li>
              <span>Heat</span>
              <strong>{{ currentLocation.heat ? currentLocation.heat + '%' : 'Baixo' }}</strong>
            </li>
          </ul>

          <button
            class="btn btn--primary btn--full"
            :disabled="busy || !canAct"
            @click="act">
            {{ busy ? 'A procurar…' : 'Iniciar busca' }}
          </button>

          <div v-if="last" class="result">
            <p class="result-label">Último relatório</p>
            <div v-if="last.error" class="result-card result-card--error">
              <p>{{ last.error }}</p>
            </div>
            <div v-else class="result-card">
              <p class="result-outcome">Outcome · <strong>{{ last.outcome }}</strong></p>
              <ul>
                <li v-if="last.awarded?.money">Dinheiro: <strong>{{ fmt(last.awarded.money) }}</strong></li>
                <li v-if="last.awarded?.items?.length">Itens: <strong>{{ last.awarded.items.join(', ') }}</strong></li>
                <li v-if="!last.awarded?.items?.length && !last.awarded?.money">Nada encontrado desta vez.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="intel-hint">
          <p class="eyebrow">Dica</p>
          <p>Aumenta a tua <strong>happiness</strong> antes desta missão para desbloquear multiplicadores ocultos e diminui a chance de falhas críticas.</p>
        </div>
      </aside>
    </div>

    <section class="sfc-timeline">
      <div>
        <p class="eyebrow">Fluxo operacional</p>
        <h3>Intel recente</h3>
      </div>
      <ul>
        <li v-for="entry in feed" :key="entry.title">
          <span class="dot" :style="{ background: entry.color }"></span>
          <div>
            <p class="feed-title">{{ entry.title }}</p>
            <p class="feed-meta">{{ entry.meta }}</p>
          </div>
          <span class="feed-time">{{ entry.time }}</span>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import api from '../../api/client'
import { usePlayer } from '../../composables/usePlayer'
import { useToast } from '../../composables/useToast'
import { fmtInt as fmt, fmtMoney, fmtDateShort as formatDate } from '../../utils/format'

const { store, ensurePlayer } = usePlayer()
const toast = useToast()
const busy = ref(false)
const last = ref(null)
const locations = ref([])
const selLoc = ref('')
const cooldownLeft = ref(0)
let cooldownTimer = null

const nerve = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nerveMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const money = computed(() => fmtMoney(store.player?.money || 0))
const canAct = computed(() => !!store.player?.user && nerve.value >= 1 && !!selLoc.value && cooldownLeft.value === 0)
const currentLocation = computed(() => locations.value.find(l => l.id === selLoc.value))
const riskLabel = computed(() => {
  const pop = currentLocation.value?.popularity || 0
  if (pop >= 0.75) return 'Alto'
  if (pop >= 0.45) return 'Médio'
  return 'Baixo'
})
const lastLabel = computed(() => {
  if (!last.value) return '—'
  if (last.value.error) return 'Falhou'
  if (last.value.awarded?.money) return `+$${fmt(last.value.awarded.money)}`
  return last.value.outcome || '—'
})

const feed = [
  { title: 'Viela Neon', meta: 'Suspeito em fuga deixou malas', time: 'há 5 min', color: 'rgba(51,255,209,0.9)' },
  { title: 'Cassino Eclipse', meta: 'Detetámos notas não rastreadas', time: 'há 18 min', color: 'rgba(249,115,22,0.9)' },
  { title: 'Hotel Oro', meta: 'Staff corrompido facilita acesso', time: 'há 37 min', color: 'rgba(125,249,198,0.9)' }
]

async function loadLocations(){
  try {
    const { data } = await api.get('/crime/locations')
    locations.value = data?.locations || []
    if (locations.value.length && !selLoc.value) selLoc.value = locations.value[0].id
  } catch { locations.value = [] }
}

function clearCooldownTimer(){
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldown(seconds = 0){
  const duration = Math.max(0, Number(seconds) || 0)
  clearCooldownTimer()
  cooldownLeft.value = duration
  if (!duration) return
  cooldownTimer = setInterval(() => {
    if (cooldownLeft.value <= 1) {
      cooldownLeft.value = 0
      clearCooldownTimer()
    } else {
      cooldownLeft.value -= 1
    }
  }, 1000)
}

async function act(){
  if (!store.player?.user || !selLoc.value) return
  busy.value = true
  try {
    const { data } = await api.post('/crime/search-for-cash', { locationId: selLoc.value })
    last.value = data
    if (data?.cooldown?.secondsLeft) startCooldown(data.cooldown.secondsLeft)
    store.mergePartial({ money: data.money })
    if (store.player?.nerveStats) store.player.nerveStats.nerve = data.nerve
  } catch (e) {
    const err = e?.response?.data?.error || e?.message || 'Failed'
    const seconds = e?.response?.data?.secondsLeft
    if (seconds) startCooldown(seconds)
    last.value = { error: err }
    toast.error(err)
  } finally { busy.value = false }
}

onMounted(async () => { await ensurePlayer(); await loadLocations() })
onUnmounted(() => clearCooldownTimer())
</script>

<style scoped>
.sfc-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.sfc-hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(10, 18, 32, 0.95), rgba(4, 10, 22, 0.85));
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.35);
}
.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.stat-card {
  padding: 14px 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}
.stat-card .label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 11px;
  color: var(--muted);
}
.stat-card strong { font-size: 1.3rem; display: block; margin-top: 8px; }

.sfc-body {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 24px;
  align-items: start;
}
.location-board, .action-panel {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(7, 9, 22, 0.9);
  padding: 24px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
}
.board-head { margin-bottom: 18px; }
.location-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.location-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 16px;
  background: rgba(10, 13, 27, 0.9);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}
.location-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35); }
.location-card.active { border-color: rgba(51, 255, 209, 0.5); background: rgba(9, 24, 31, 0.95); }
.location-card__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.location-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 10px;
  color: var(--muted);
}
.chance {
  font-weight: 700;
  color: var(--accent-secondary);
}
.location-desc { color: var(--muted); min-height: 42px; }
.pop {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.pop__bar { height: 100%; background: linear-gradient(90deg, #33ffd1, #1fd7b0); }
.location-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }

.action-panel__body { display: flex; flex-direction: column; gap: 16px; }
.action-facts { list-style: none; padding: 0; margin: 0; display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.action-facts li { flex: 1 1 90px; }
.action-facts span { text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; color: var(--muted); }
.action-facts strong { display: block; font-size: 1rem; color: var(--text-strong); }
.btn--full { width: 100%; }
.result { display: flex; flex-direction: column; gap: 8px; }
.result-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 14px;
  background: rgba(12, 16, 34, 0.9);
}
.result-card--error { border-color: rgba(255, 107, 107, 0.4); color: var(--danger); }
.result-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: var(--muted); }
.result-card ul { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.95rem; }
.intel-hint {
  margin-top: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  padding: 16px;
  background: rgba(5, 10, 20, 0.9);
}

.sfc-timeline {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
  background: rgba(7, 9, 22, 0.9);
}
.sfc-timeline ul { list-style: none; padding: 0; margin: 20px 0 0; display: flex; flex-direction: column; gap: 14px; }
.sfc-timeline li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 10px currentColor;
}
.feed-title { font-weight: 600; }
.feed-meta { font-size: 12px; color: var(--muted); }
.feed-time { font-size: 12px; color: var(--muted); }

@media (max-width: 960px) {
  .sfc-body { grid-template-columns: 1fr; }
}
</style>
