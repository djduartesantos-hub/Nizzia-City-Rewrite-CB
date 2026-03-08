<template>
  <section class="pp-page">
    <header class="pp-hero">
      <div>
        <p class="eyebrow">Operação sombra</p>
        <h1>Pickpocket League</h1>
        <p class="muted">
          Circuito elite de furtos em zonas densas. Escolhe o alvo, equipa o traje certo e coordena o teu lookout para sair antes dos alarmes.
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
          <span class="label">Stealth rating</span>
          <strong>{{ stealthScore }}</strong>
        </div>
      </div>
    </header>

    <div class="pp-body">
      <div class="panel targets">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Alvos ativos</p>
            <h2>Zonas de oportunidade</h2>
          </div>
          <span class="muted">Atualizado a cada 10 minutos</span>
        </div>
        <div class="target-grid">
          <button
            v-for="t in targets"
            :key="t.id"
            class="target-card"
            :class="{ active: t.id === selectedTarget }"
            @click="selectedTarget = t.id">
            <div class="target-card__head">
              <div>
                <p class="target-label">{{ t.city }}</p>
                <h3>{{ t.name }}</h3>
              </div>
              <span class="chance">{{ t.success }}%</span>
            </div>
            <p class="target-desc">{{ t.desc }}</p>
            <div class="target-meta">
              <div>
                <span class="label">Vigilância</span>
                <strong>{{ t.watchers }}</strong>
              </div>
              <div>
                <span class="label">Heat</span>
                <strong>{{ t.heat }}</strong>
              </div>
              <div>
                <span class="label">Payout</span>
                <strong>{{ t.reward[0] }}-{{ t.reward[1] }} ¢</strong>
              </div>
            </div>
            <div class="target-trace">
              <div
                class="trace-fill"
                :style="{ width: `${t.success}%` }"></div>
            </div>
          </button>
        </div>
      </div>

      <div class="panel action">
        <div class="action-head">
          <div>
            <p class="eyebrow small">Loadout</p>
            <h2>Configura a equipa</h2>
          </div>
          <span class="muted">Combina até +18% de sucesso</span>
        </div>

        <div class="loadouts">
          <div>
            <p class="label">Traje</p>
            <div class="chip-row">
              <button
                v-for="gear in gearOptions"
                :key="gear.id"
                class="chip"
                :class="{ active: selectedGear === gear.id }"
                @click="selectedGear = gear.id">
                {{ gear.label }}
              </button>
            </div>
            <p class="muted tiny">{{ gearCopy }}</p>
          </div>
          <div>
            <p class="label">Suporte</p>
            <div class="chip-row">
              <button
                v-for="crew in crewOptions"
                :key="crew.id"
                class="chip"
                :class="{ active: selectedCrew === crew.id }"
                @click="selectedCrew = crew.id">
                {{ crew.label }}
              </button>
            </div>
            <p class="muted tiny">{{ crewCopy }}</p>
          </div>
        </div>

        <div class="action-body">
          <div>
            <p class="muted">Probabilidade estimada</p>
            <div class="prob">
              <span>{{ successChance }}%</span>
              <div class="prob-bar">
                <div class="prob-fill" :style="{ width: `${successChance}%` }"></div>
              </div>
            </div>
          </div>
          <div>
            <p class="muted">Estimativa de loot</p>
            <h3>{{ estimatedLoot }}</h3>
          </div>
        </div>

        <button class="btn btn--primary full" :disabled="!canRun" @click="runHeist">
          {{ actionLabel }}
        </button>
        <p v-if="cooldownLeft" class="cooldown-hint">Disponível em {{ cooldownLeft }}s</p>

        <article v-if="lastRun" class="result">
          <header>
            <h4>{{ lastRun.success ? 'Extração limpa' : 'Detetados' }}</h4>
            <span>{{ lastRun.timestamp }}</span>
          </header>
          <p>{{ lastRun.blurb }}</p>
          <div class="result-meta">
            <div>
              <span class="label">Payout</span>
              <strong>{{ lastRun.success ? fmtMoney(lastRun.payout) : '—' }}</strong>
            </div>
            <div>
              <span class="label">Heat</span>
              <strong>{{ lastRun.heat }}%</strong>
            </div>
            <div>
              <span class="label">Alvo</span>
              <strong>{{ lastRun.target }}</strong>
            </div>
          </div>
        </article>
      </div>

      <div class="panel intel">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Observações</p>
            <h2>Feed em tempo real</h2>
          </div>
          <span class="muted">Últimas 24h</span>
        </div>
        <ul class="intel-list">
          <li v-for="item in intelFeed" :key="item.label">
            <span class="dot" :style="{ background: item.color }"></span>
            <div>
              <p class="intel-title">{{ item.label }}</p>
              <p class="intel-meta">{{ item.meta }}</p>
            </div>
            <span class="intel-time">{{ item.time }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import api from '../../api/client'
import { usePlayer } from '../../composables/usePlayer'
import { useToast } from '../../composables/useToast'
import { fmtMoney } from '../../utils/format'

const { store, ensurePlayer } = usePlayer()
const toast = useToast()
onMounted(async () => { await ensurePlayer() })

const nerve = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nerveMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const money = computed(() => fmtMoney(store.player?.money || 0))
const stealthScore = computed(() => {
  const level = store.player?.level ?? 12
  return `${level * 3} pts`
})

const targets = [
  {
    id: 'neon-bazaar',
    name: 'Mercado Neon',
    city: 'Distrito Prism',
    desc: 'Vendedores distraídos, muito ruído ambiente e turistas carregados.',
    reward: [120, 320],
    watchers: 2,
    heat: 'Baixo',
    success: 68,
  },
  {
    id: 'tram-expo',
    name: 'Tram Expo',
    city: 'Linha Orbital',
    desc: 'Transportes lotados, guards em patrulha e passagens apertadas.',
    reward: [200, 420],
    watchers: 4,
    heat: 'Moderado',
    success: 52,
  },
  {
    id: 'skylux-gala',
    name: 'Gala Skylux',
    city: 'Skylux 88º',
    desc: 'Elite distraída com hologramas. Segurança privada ultra rápida.',
    reward: [420, 880],
    watchers: 6,
    heat: 'Elevado',
    success: 38,
  },
]

const gearOptions = [
  { id: 'smart-fabric', label: 'Smart fabric', bonus: 6, desc: 'Camuflagem térmica e pockets ocultos.' },
  { id: 'pulse-jammer', label: 'Pulse jammer', bonus: 8, desc: 'Bloqueia tags RFID por 12s.' },
  { id: 'microdrone', label: 'Microdrone', bonus: 4, desc: 'Ajuda na rota de fuga.' },
]

const crewOptions = [
  { id: 'solo', label: 'Solo', bonus: 0, desc: 'Menos partilha, mais risco.' },
  { id: 'lookout', label: 'Lookout', bonus: 5, desc: 'Observador comunica via auricular.' },
  { id: 'decoy', label: 'Decoy crew', bonus: 7, desc: 'Dupla cria distrações programadas.' },
]

const selectedTarget = ref(targets[0].id)
const selectedGear = ref(gearOptions[0].id)
const selectedCrew = ref(crewOptions[0].id)
const lastRun = ref(null)
const busy = ref(false)
const cooldownLeft = ref(0)
let cooldownTimer = null

const activeTarget = computed(() => targets.find(t => t.id === selectedTarget.value) || targets[0])
const gearCopy = computed(() => gearOptions.find(g => g.id === selectedGear.value)?.desc || '')
const crewCopy = computed(() => crewOptions.find(c => c.id === selectedCrew.value)?.desc || '')
const canRun = computed(() => !busy.value && cooldownLeft.value === 0 && nerve.value >= 4)
const actionLabel = computed(() => {
  if (busy.value) return 'A executar...'
  if (cooldownLeft.value) return `Cooldown ${cooldownLeft.value}s`
  return 'Iniciar operação'
})

const successChance = computed(() => {
  const base = activeTarget.value.success
  const gear = gearOptions.find(g => g.id === selectedGear.value)?.bonus || 0
  const crew = crewOptions.find(c => c.id === selectedCrew.value)?.bonus || 0
  return Math.min(96, base + gear + crew)
})

const estimatedLoot = computed(() => {
  const [min, max] = activeTarget.value.reward
  const mid = Math.round((min + max) / 2)
  return `${mid} ¢`
})

const intelFeed = [
  { label: 'Mercado Neon', meta: 'Dois guardas afastados por alarme falso.', color: 'rgba(51,255,209,0.8)', time: '10:12' },
  { label: 'Tram Expo', meta: 'Patrulha extra até 21h.', color: 'rgba(249,115,22,0.8)', time: '09:47' },
  { label: 'Skylux', meta: 'Novo scanner facial em teste.', color: 'rgba(125,249,198,0.8)', time: '08:55' },
  { label: 'Mercado Neon', meta: 'Turistas VIP confirmados.', color: 'rgba(59,130,246,0.8)', time: '07:30' },
]

const successBlurbs = [
  'Saída limpa via túneis de serviço. Os scanners nem chegaram a calibrar.',
  'Transferimos as wallets antes do security sweep, zero pistas.',
  'Lookout desviou o chefe de segurança e abrimos espaço para sacar 3 chips gold.',
]
const failBlurbs = [
  'Sensor acústico detectou o jammer. Fomos expulsos antes de tocar no loot.',
  'Lookout perdeu sinal e os drones seguiram o calor corporal.',
  'Um VIP reconheceu o disfarce. Retirada forçada, heat elevado.',
]

async function runHeist() {
  if (!canRun.value) return
  busy.value = true
  try {
    const payload = {
      targetId: selectedTarget.value,
      gearId: selectedGear.value,
      crewId: selectedCrew.value,
    }
    const { data } = await api.post('/crime/pickpocket', payload)
    applyResult(data)
  } catch (e) {
    handleError(e)
  } finally {
    busy.value = false
  }
}

function applyResult(data = {}) {
  const result = data.result || {}
  const details = result.details || {}
  if (data.cooldown?.secondsLeft) startCooldown(data.cooldown.secondsLeft)
  store.mergePartial({ money: data.money })
  if (store.player?.nerveStats) store.player.nerveStats.nerve = data.nerve
  lastRun.value = {
    success: !!result.success,
    payout: result.payout ?? 0,
    heat: result.heat ?? null,
    target: details.target || activeTarget.value.name,
    blurb: details.blurb || (result.success ? pick(successBlurbs) : pick(failBlurbs)),
    timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
  }
}

function handleError(e) {
  const payload = e?.response?.data || {}
  const message = payload.error || e?.message || 'Falha na operação'
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
.pp-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.pp-hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid rgba(255,255,255,0.08);
  background: linear-gradient(135deg, rgba(10,16,35,0.95), rgba(5,12,24,0.85));
}
.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.stat-card {
  flex: 1;
  min-width: 160px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}
.pp-body {
  display: grid;
  grid-template-columns: 1.3fr 1fr 0.8fr;
  gap: 20px;
}
.panel {
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 22px;
  background: rgba(6,10,24,0.92);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.eyebrow.small { letter-spacing: 0.3em; font-size: 10px; }
.target-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.target-card {
  border-radius: 20px;
  padding: 18px;
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.05);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.target-card.active {
  border-color: rgba(51,255,209,0.6);
  background: rgba(51,255,209,0.05);
}
.target-card__head {
  display: flex;
  justify-content: space-between;
}
.target-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 11px;
  color: var(--muted);
}
.target-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.target-trace {
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
}
.trace-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(51,255,209,1), rgba(15,182,255,0.8));
}
.action .chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  border: 1px solid rgba(255,255,255,0.08);
  padding: 6px 14px;
  border-radius: 999px;
  text-transform: uppercase;
  font-size: 11px;
}
.chip.active {
  border-color: rgba(51,255,209,0.9);
  background: rgba(51,255,209,0.08);
}
.loadouts { display: flex; flex-direction: column; gap: 20px; }
.action-body {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.prob span { font-size: 28px; font-weight: 700; }
.prob-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
}
.prob-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
}
.full { width: 100%; }
.result {
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 16px;
  background: rgba(0,0,0,0.3);
}
.result header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.result-meta {
  margin-top: 12px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
}
.cooldown-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}
.intel-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.intel-list li {
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
.intel-title { font-weight: 600; }
.intel-meta { font-size: 12px; color: var(--muted); }
.intel-time { font-size: 12px; color: rgba(255,255,255,0.5); }

@media (max-width: 1200px) {
  .pp-body { grid-template-columns: 1fr; }
}
</style>
