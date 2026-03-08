<template>
  <section class="smug-page">
    <header class="smug-hero">
      <div>
        <p class="eyebrow">Operação logística</p>
        <h1>Smuggling Ops</h1>
        <p class="muted">
          Rotas costeiras, drones stealth e comboios fantasma. Gere calor, escolhe a carga e coordena escolta aérea para mover tech raro sem deixar rasto.
        </p>
      </div>
      <div class="hero-stats">
        <div class="stat-card">
          <span class="label">Dinheiro</span>
          <strong>{{ money }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Nerve</span>
          <strong>{{ nerve }}/{{ nerveMax }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Cargo rating</span>
          <strong>{{ cargoRating }}</strong>
        </div>
      </div>
    </header>

    <div class="smug-body">
      <div class="panel convoy">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Rotas</p>
            <h2>Corredores clandestinos</h2>
          </div>
          <span class="muted">Heat global {{ globalHeat }}%</span>
        </div>
        <div class="route-grid">
          <button
            v-for="route in routes"
            :key="route.id"
            class="route-card"
            :class="{ active: route.id === selectedRoute }"
            @click="selectedRoute = route.id">
            <div class="route-head">
              <div>
                <p class="route-label">{{ route.region }}</p>
                <h3>{{ route.name }}</h3>
              </div>
              <span class="badge">{{ route.success }}%</span>
            </div>
            <p class="route-desc">{{ route.desc }}</p>
            <div class="route-meta">
              <div>
                <span class="label">Carga</span>
                <strong>{{ route.capacity }}T</strong>
              </div>
              <div>
                <span class="label">Escolta</span>
                <strong>{{ route.escort }}</strong>
              </div>
              <div>
                <span class="label">Tempo</span>
                <strong>{{ route.duration }}</strong>
              </div>
            </div>
            <div class="heat-bar">
              <div class="heat-fill" :style="{ width: `${route.heat}%` }"></div>
            </div>
          </button>
        </div>
      </div>

      <div class="panel cargo">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Manifesto</p>
            <h2>Escolhe carga e escolta</h2>
          </div>
          <span class="muted">Influência total {{ influence }} pts</span>
        </div>
        <div class="cargo-block">
          <p class="label">Carga</p>
          <div class="chip-row">
            <button
              v-for="cargo in cargoOptions"
              :key="cargo.id"
              class="chip"
              :class="{ active: selectedCargo === cargo.id }"
              @click="selectedCargo = cargo.id">
              {{ cargo.label }}
            </button>
          </div>
          <p class="muted tiny">{{ cargoCopy }}</p>
        </div>
        <div class="cargo-block">
          <p class="label">Escolta</p>
          <div class="chip-row">
            <button
              v-for="escort in escortOptions"
              :key="escort.id"
              class="chip"
              :class="{ active: selectedEscort === escort.id }"
              @click="selectedEscort = escort.id">
              {{ escort.label }}
            </button>
          </div>
          <p class="muted tiny">{{ escortCopy }}</p>
        </div>
        <div class="cargo-metrics">
          <div>
            <p class="muted">Capacidade ocupada</p>
            <div class="meter">
              <strong>{{ capacityUsage }}%</strong>
              <div class="meter-track">
                <div class="meter-fill" :style="{ width: `${capacityUsage}%` }"></div>
              </div>
            </div>
          </div>
          <div>
            <p class="muted">Risco detectado</p>
            <div class="risk-chip">{{ riskCopy }}</div>
          </div>
          <div>
            <p class="muted">Reward estimado</p>
            <h3>{{ rewardEstimate }}</h3>
          </div>
        </div>
      </div>

      <div class="panel action">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Execução</p>
            <h2>Controle de missão</h2>
          </div>
          <span class="muted">Telemetria em direto</span>
        </div>
        <button class="btn btn--primary full" :disabled="!canRun" @click="runConvoy">
          {{ actionLabel }}
        </button>
        <p v-if="cooldownLeft" class="cooldown-hint">Disponível em {{ cooldownLeft }}s</p>
        <article v-if="lastRun" class="result">
          <header>
            <div>
              <p class="eyebrow tiny">{{ lastRun.success ? 'Carga entregue' : 'Interceção' }}</p>
              <h4>{{ lastRun.route }}</h4>
            </div>
            <span>{{ lastRun.timestamp }}</span>
          </header>
          <p>{{ lastRun.blurb }}</p>
          <ul class="result-meta">
            <li>
              <span class="label">Lucro</span>
              <strong>{{ lastRun.success ? fmtMoney(lastRun.payout) : '—' }}</strong>
            </li>
            <li>
              <span class="label">Heat</span>
              <strong>{{ lastRun.heat }}%</strong>
            </li>
            <li>
              <span class="label">Carga</span>
              <strong>{{ lastRun.cargo }}</strong>
            </li>
          </ul>
        </article>
        <div class="timeline">
          <p class="eyebrow tiny">Relatórios de zona</p>
          <ul>
            <li v-for="item in intelFeed" :key="item.title">
              <span class="dot" :style="{ background: item.color }"></span>
              <div>
                <p class="intel-title">{{ item.title }}</p>
                <p class="intel-meta">{{ item.meta }}</p>
              </div>
              <span class="intel-time">{{ item.time }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import api from '../../api/client'
import { usePlayer } from '../../composables/usePlayer'
import { useToast } from '../../composables/useToast'
import { fmtHms, fmtMoney } from '../../utils/format'

const { store, ensurePlayer } = usePlayer()
const toast = useToast()
onMounted(async () => { await ensurePlayer() })

const nerve = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nerveMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const money = computed(() => fmtMoney(store.player?.money || 0))
const cargoRating = computed(() => `${(store.player?.cartelReputation || 12) * 3} pts`)
const globalHeat = computed(() => store.player?.heat ?? 24)
const influence = computed(() => store.player?.cartelReputation ?? 120)

const routes = [
  {
    id: 'aurora-run',
    name: 'Aurora Run',
    region: 'Cinturão boreal',
    desc: 'Comboio silencioso atravessa túneis congelados com beacons fantasma.',
    capacity: 12,
    escort: 'VTOL stealth',
    duration: '32m',
    heat: 28,
    success: 78,
  },
  {
    id: 'sunken-trade',
    name: 'Sunken Trade',
    region: 'Porto Orion',
    desc: 'Submarino modular troca cascos no meio do trajeto para perder rastreio.',
    capacity: 18,
    escort: 'Drones Hydra',
    duration: '46m',
    heat: 42,
    success: 63,
  },
  {
    id: 'skycaravan',
    name: 'Sky Caravan',
    region: 'Eixo Astra',
    desc: 'Balões de hélio negros com propulsão iónica. Quase invisíveis ao radar.',
    capacity: 22,
    escort: 'Caça Specter',
    duration: '58m',
    heat: 55,
    success: 48,
  },
]

const cargoOptions = [
  { id: 'biochips', label: 'Biochips', capacity: 40, reward: 48000, desc: '+15% procura nos mercados de Elysium.' },
  { id: 'plasma', label: 'Plasma cores', capacity: 60, reward: 72000, desc: 'Precisa de refrigeração constante, risco médio.' },
  { id: 'relics', label: 'Relíquias', capacity: 30, reward: 96000, desc: 'Contrabando cultural, scanners em alerta.' },
]

const escortOptions = [
  { id: 'mirage', label: 'Mirage wing', bonus: 12, desc: 'Drones de camuflagem ativa bloqueiam satélites.' },
  { id: 'riptide', label: 'Riptide subs', bonus: 8, desc: 'Interferem com sonar e minas.' },
  { id: 'phantom', label: 'Phantom riders', bonus: 5, desc: 'Motards que cortam rotas terrestres.' },
]

const intelFeed = [
  { title: 'Aurora Run', meta: 'Patrulhas reduziram para 2 drones.', color: 'rgba(51,255,209,0.8)', time: '10:20' },
  { title: 'Sunken Trade', meta: 'Sensor térmico novo na doca oeste.', color: 'rgba(249,115,22,0.8)', time: '09:58' },
  { title: 'Sky Caravan', meta: 'Tempestade magnética abre janela de 6min.', color: 'rgba(59,130,246,0.8)', time: '09:11' },
]

const selectedRoute = ref(routes[0].id)
const selectedCargo = ref(cargoOptions[0].id)
const selectedEscort = ref(escortOptions[0].id)
const lastRun = ref(null)
const busy = ref(false)
const cooldownLeft = ref(0)
const cooldownLabel = computed(() => fmtHms(cooldownLeft.value))
let cooldownTimer = null

const activeRoute = computed(() => routes.find(r => r.id === selectedRoute.value) || routes[0])
const cargoCopy = computed(() => cargoOptions.find(c => c.id === selectedCargo.value)?.desc || '')
const escortCopy = computed(() => escortOptions.find(e => e.id === selectedEscort.value)?.desc || '')
const canRun = computed(() => !busy.value && cooldownLeft.value === 0 && nerve.value >= 10)
const actionLabel = computed(() => {
  if (busy.value) return 'Coordenando drones...'
  if (cooldownLeft.value) return `Cooldown ${cooldownLabel.value}`
  return 'Despachar comboio'
})

const capacityUsage = computed(() => {
  const cargo = cargoOptions.find(c => c.id === selectedCargo.value)
  if (!cargo) return 0
  const usage = Math.round((cargo.capacity / (activeRoute.value.capacity * 10)) * 100)
  return Math.min(100, usage)
})

const riskCopy = computed(() => {
  if (activeRoute.value.success >= 75) return 'Baixo'
  if (activeRoute.value.success >= 60) return 'Controlado'
  if (activeRoute.value.success >= 45) return 'Moderado'
  return 'Elevado'
})

const rewardEstimate = computed(() => {
  const cargo = cargoOptions.find(c => c.id === selectedCargo.value)
  if (!cargo) return '—'
  return fmtMoney(cargo.reward * (0.7 + successChance.value / 150))
})

const successChance = computed(() => {
  const route = activeRoute.value.success
  const escort = escortOptions.find(e => e.id === selectedEscort.value)?.bonus || 0
  const cargoPenalty = cargoOptions.find(c => c.id === selectedCargo.value)?.capacity || 0
  const penalty = Math.round(cargoPenalty / 15)
  return Math.min(94, Math.max(20, route + escort - penalty))
})

async function runConvoy() {
  if (!canRun.value) return
  busy.value = true
  try {
    const payload = {
      routeId: selectedRoute.value,
      cargoId: selectedCargo.value,
      escortId: selectedEscort.value,
    }
    const { data } = await api.post('/crime/smuggling', payload)
    applyResult(data)
  } catch (e) {
    handleError(e)
  } finally {
    busy.value = false
  }
}

const successBlurbs = [
  'TTX reforçado atravessou o nevoeiro sem qualquer ping nos radares.',
  'Drones Mirage confundiram satélites e entregámos 100% da carga.',
  'Escolta Phantom fez cortejo urbano que baralhou as patrulhas.',
]

const failBlurbs = [
  'Tempestade magnética derrubou o VTOL, escolta abortou.',
  'Interceptores detectaram assinatura térmica do submersível.',
  'Tropas federais seguiram o comboio fantasma via satélite secundário.',
]

function applyResult(data = {}) {
  const result = data.result || {}
  const details = result.details || {}
  if (data.cooldown?.secondsLeft) startCooldown(data.cooldown.secondsLeft)
  store.mergePartial({ money: data.money })
  if (store.player?.nerveStats) store.player.nerveStats.nerve = data.nerve
  lastRun.value = {
    success: !!result.success,
    route: details.route || activeRoute.value.name,
    payout: result.payout ?? 0,
    heat: result.heat ?? null,
    cargo: details.cargo,
    blurb: details.blurb || (result.success ? pick(successBlurbs) : pick(failBlurbs)),
    timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
  }
}

function handleError(e) {
  const payload = e?.response?.data || {}
  const message = payload.error || e?.message || 'Falha no comboio'
  if (payload.secondsLeft) startCooldown(payload.secondsLeft)
  toast.error(message)
}

function clearCooldownTimer() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldown(seconds = 0) {
  const total = Math.max(0, Number(seconds) || 0)
  cooldownLeft.value = total
  clearCooldownTimer()
  if (!total) return
  cooldownTimer = setInterval(() => {
    if (cooldownLeft.value <= 1) {
      cooldownLeft.value = 0
      clearCooldownTimer()
    } else {
      cooldownLeft.value -= 1
    }
  }, 1000)
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

onUnmounted(() => clearCooldownTimer())
</script>

<style scoped>
.smug-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.smug-hero {
  border-radius: 32px;
  padding: 30px;
  background: linear-gradient(135deg, rgba(8,12,24,0.95), rgba(4,10,18,0.88));
  border: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hero-stats { display: flex; flex-wrap: wrap; gap: 14px; }
.stat-card {
  min-width: 160px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}
.smug-body {
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.9fr;
  gap: 20px;
}
.panel {
  border-radius: 26px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(5,8,20,0.9);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-head { display: flex; justify-content: space-between; gap: 12px; }
.route-grid { display: flex; flex-direction: column; gap: 14px; }
.route-card {
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.01);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}
.route-card.active {
  border-color: rgba(51,255,209,0.55);
  background: rgba(51,255,209,0.05);
}
.route-head { display: flex; justify-content: space-between; align-items: center; }
.route-label { text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; color: var(--muted); }
.badge { padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,0.08); }
.route-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; }
.heat-bar {
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
}
.heat-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), #f97316);
}
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  border-radius: 999px;
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.08);
  text-transform: uppercase;
  font-size: 11px;
}
.chip.active { border-color: rgba(51,255,209,0.85); background: rgba(51,255,209,0.08); }
.cargo-metrics { display: flex; flex-wrap: wrap; gap: 18px; }
.meter-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); }
.meter-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), #0ea5e9); }
.risk-chip { border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 6px 14px; }
.full { width: 100%; }
.result {
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 16px;
  background: rgba(0,0,0,0.35);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.result-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; }
.cooldown-hint { margin-top: 6px; font-size: 12px; color: var(--muted); }
.timeline ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.timeline li { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; }
.dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
@media (max-width: 1200px) {
  .smug-body { grid-template-columns: 1fr; }
}
</style>
