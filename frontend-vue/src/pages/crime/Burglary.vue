<template>
  <section class="burglary-page">
    <header class="burglary-hero">
      <div>
        <p class="eyebrow">Operação sigilosa</p>
        <h1>Burglary Grid</h1>
        <p class="muted">
          Escala arranha-céus luxuosos, corta lasers e sincroniza a equipa fantasma para sair antes que o alarme mude de cor.
          Cada plano gera <strong>intel</strong> para assaltos maiores.
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
          <span class="label">Tap skill</span>
          <strong>{{ infilRating }}</strong>
        </div>
      </div>
    </header>

    <div class="burglary-body">
      <div class="panel blueprint">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Targets premium</p>
            <h2>Penthouses em rotação</h2>
          </div>
          <span class="muted">Heat global {{ globalHeat }}%</span>
        </div>
        <div class="target-grid">
          <button
            v-for="spot in estates"
            :key="spot.id"
            class="target-card"
            :class="{ active: spot.id === selectedEstate }"
            @click="selectedEstate = spot.id">
            <header>
              <div>
                <p class="target-label">{{ spot.city }}</p>
                <h3>{{ spot.name }}</h3>
              </div>
              <span class="badge">{{ spot.success }}%</span>
            </header>
            <p class="target-desc">{{ spot.desc }}</p>
            <ul class="target-meta">
              <li>
                <span class="label">Segurança</span>
                <strong>{{ spot.security }}</strong>
              </li>
              <li>
                <span class="label">Guarda</span>
                <strong>{{ spot.guards }}</strong>
              </li>
              <li>
                <span class="label">Payout</span>
                <strong>{{ spot.reward[0] }}-{{ spot.reward[1] }} ¢</strong>
              </li>
            </ul>
            <div class="schematic">
              <div class="schematic-fill" :style="{ width: `${spot.success}%` }"></div>
            </div>
          </button>
        </div>
      </div>

      <div class="panel gadgets">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Preparedness</p>
            <h2>Loadout furtivo</h2>
          </div>
          <span class="muted">Combina ferramentas e entrada</span>
        </div>
        <div class="loadout-block">
          <p class="label">Ferramentas diretas</p>
          <div class="chip-row">
            <button
              v-for="tool in toolkits"
              :key="tool.id"
              class="chip"
              :class="{ active: selectedToolkit === tool.id }"
              @click="selectedToolkit = tool.id">
              {{ tool.label }}
            </button>
          </div>
          <p class="muted tiny">{{ toolkitCopy }}</p>
        </div>
        <div class="loadout-block">
          <p class="label">Equipe de entrada</p>
          <div class="chip-row">
            <button
              v-for="entry in entryTeams"
              :key="entry.id"
              class="chip"
              :class="{ active: selectedEntry === entry.id }"
              @click="selectedEntry = entry.id">
              {{ entry.label }}
            </button>
          </div>
          <p class="muted tiny">{{ entryCopy }}</p>
        </div>
        <div class="phase-list">
          <article v-for="phase in phases" :key="phase.title">
            <header>
              <h4>{{ phase.title }}</h4>
              <span>{{ phase.window }}</span>
            </header>
            <p>{{ phase.desc }}</p>
          </article>
        </div>
      </div>

      <div class="panel action">
        <div class="panel-head">
          <div>
            <p class="eyebrow small">Execução</p>
            <h2>Plano em tempo real</h2>
          </div>
          <span class="muted">Atualiza após cada run</span>
        </div>
        <div class="action-grid">
          <div>
            <p class="muted">Chance</p>
            <div class="meter">
              <strong>{{ successChance }}%</strong>
              <div class="meter-track">
                <div class="meter-fill" :style="{ width: `${successChance}%` }"></div>
              </div>
            </div>
          </div>
          <div>
            <p class="muted">Risco detectado</p>
            <div class="risk-chip">{{ riskCopy }}</div>
          </div>
          <div>
            <p class="muted">Estimativa loot</p>
            <h3>{{ lootEstimate }}</h3>
          </div>
        </div>
        <button class="btn btn--primary full" :disabled="!canRun" @click="runBurglary">
          {{ actionLabel }}
        </button>
        <p v-if="cooldownLeft" class="cooldown-hint">Disponível em {{ cooldownLeft }}s</p>
        <article v-if="lastRun" class="result">
          <header>
            <div>
              <p class="eyebrow tiny">{{ lastRun.success ? 'Extração perfeita' : 'Comprometidos' }}</p>
              <h4>{{ lastRun.target }}</h4>
            </div>
            <span>{{ lastRun.timestamp }}</span>
          </header>
          <p>{{ lastRun.blurb }}</p>
          <ul class="result-meta">
            <li>
              <span class="label">Payout</span>
              <strong>{{ lastRun.success ? fmtMoney(lastRun.payout) : '—' }}</strong>
            </li>
            <li>
              <span class="label">Heat</span>
              <strong>{{ lastRun.heat }}%</strong>
            </li>
            <li>
              <span class="label">Intel</span>
              <strong>{{ lastRun.intel }}</strong>
            </li>
          </ul>
        </article>
        <div class="timeline">
          <p class="eyebrow tiny">Feed interno</p>
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
import { fmtMoney } from '../../utils/format'

const { store, ensurePlayer } = usePlayer()
const toast = useToast()
onMounted(async () => { await ensurePlayer() })

const nerve = computed(() => store.player?.nerveStats?.nerve ?? 0)
const nerveMax = computed(() => store.player?.nerveStats?.nerveMax ?? 0)
const money = computed(() => fmtMoney(store.player?.money || 0))
const infilRating = computed(() => `${(store.player?.crimesSuccessful || 14) * 2} pts`)
const globalHeat = computed(() => store.player?.heat ?? 18)

const estates = [
  {
    id: 'skylane',
    name: 'Skylane Pinnacle',
    city: 'Mirage Spire',
    desc: 'Cobertura com vault holográfico e drones orbitais.',
    security: 'Nível V',
    guards: '4 drones',
    reward: [4200, 7800],
    success: 54,
  },
  {
    id: 'helios',
    name: 'Helios Suites',
    city: 'Distrito Helix',
    desc: 'Suites geminadas ligadas por ponte luminosa. Padrões previsíveis.',
    security: 'Nível III',
    guards: '2 sentry bots',
    reward: [2600, 5200],
    success: 72,
  },
  {
    id: 'vault-99',
    name: 'Vault 99',
    city: 'Sky Harbor',
    desc: 'Penthouse bunker com cofre magnético e sensores táteis.',
    security: 'Nível VII',
    guards: '6 agentes',
    reward: [5800, 11000],
    success: 41,
  },
]

const toolkits = [
  { id: 'phase', label: 'Phase cutter', bonus: 8, desc: 'Corta lasers e vidro acústico.' },
  { id: 'ghostkey', label: 'Ghost key', bonus: 5, desc: 'Clona biometria durante 18s.' },
  { id: 'drone', label: 'Micro drone', bonus: 3, desc: 'Projeta planta em RA.' },
]

const entryTeams = [
  { id: 'ghosts', label: 'Ghost runners', bonus: 7, desc: 'Dupla sincroniza passos com música ambiente.' },
  { id: 'insider', label: 'Insider badge', bonus: 5, desc: 'Staff corrupta fornece acesso de serviço.' },
  { id: 'solo', label: 'Solo climb', bonus: 0, desc: 'Risco alto, payout integral.' },
]

const phases = [
  { title: 'Recon orbital', window: '21:00', desc: 'Satélite interpreta padrões de drones e envia mapa tático.' },
  { title: 'Entrada vertical', window: '22:40', desc: 'Cabo de grafeno com suporte magnético e contrapeso automático.' },
  { title: 'Extração', window: '23:05', desc: 'Zip-line até skyvan, jamming EMP cobre fuga.' },
]

const intelFeed = [
  { title: 'Skylane', meta: 'Janela de serviço abre 23:02 por 90s.', color: 'rgba(51,255,209,0.8)', time: '10:11' },
  { title: 'Vault 99', meta: 'Laser grid recalibra a cada 4 rotações.', color: 'rgba(249,115,22,0.9)', time: '09:55' },
  { title: 'Helios', meta: 'Card chave replicado, válido 2 runs.', color: 'rgba(59,130,246,0.9)', time: '09:20' },
]

const selectedEstate = ref(estates[0].id)
const selectedToolkit = ref(toolkits[0].id)
const selectedEntry = ref(entryTeams[0].id)
const lastRun = ref(null)
const busy = ref(false)
const cooldownLeft = ref(0)
let cooldownTimer = null

const activeEstate = computed(() => estates.find(e => e.id === selectedEstate.value) || estates[0])
const toolkitCopy = computed(() => toolkits.find(t => t.id === selectedToolkit.value)?.desc || '')
const entryCopy = computed(() => entryTeams.find(t => t.id === selectedEntry.value)?.desc || '')
const canRun = computed(() => !busy.value && cooldownLeft.value === 0 && nerve.value >= 7)
const actionLabel = computed(() => {
  if (busy.value) return 'Sincronizando...'
  if (cooldownLeft.value) return `Cooldown ${cooldownLeft.value}s`
  return 'Iniciar infiltração'
})

const successChance = computed(() => {
  const base = activeEstate.value.success
  const tool = toolkits.find(t => t.id === selectedToolkit.value)?.bonus || 0
  const entry = entryTeams.find(t => t.id === selectedEntry.value)?.bonus || 0
  return Math.min(97, base + tool + entry)
})

const lootEstimate = computed(() => {
  const [min, max] = activeEstate.value.reward
  return `${Math.round((min + max) / 2)} ¢`
})

const riskCopy = computed(() => {
  if (successChance.value >= 80) return 'Baixo'
  if (successChance.value >= 60) return 'Controlado'
  if (successChance.value >= 45) return 'Moderado'
  return 'Elevado'
})

async function runBurglary() {
  if (!canRun.value) return
  busy.value = true
  try {
    const payload = {
      estateId: selectedEstate.value,
      toolkitId: selectedToolkit.value,
      entryId: selectedEntry.value,
    }
    const { data } = await api.post('/crime/burglary', payload)
    applyResult(data)
  } catch (e) {
    handleError(e)
  } finally {
    busy.value = false
  }
}

const successBlurbs = [
  'Escada externa reprogramada, saída via telhado auxiliar sem alarmes.',
  'Drone fantasma sincronizado com iluminação — zero testemunhas.',
  'Elevador de serviço ficou em loop, equipa desceu invisível.',
]

const failBlurbs = [
  'Laser grid voltou mais cedo; suits ficaram marcados com tinta UV.',
  'Um bot reconheceu a corda; tivemos de cortar a missão.',
  'Cartão insider bloqueado, equipe exposta no lobby.',
]

function applyResult(data = {}) {
  const result = data.result || {}
  const details = result.details || {}
  if (data.cooldown?.secondsLeft) startCooldown(data.cooldown.secondsLeft)
  store.mergePartial({ money: data.money })
  if (store.player?.nerveStats) store.player.nerveStats.nerve = data.nerve
  lastRun.value = {
    success: !!result.success,
    target: details.target || activeEstate.value.name,
    payout: result.payout ?? 0,
    heat: result.heat ?? null,
    intel: details.intel,
    blurb: details.blurb || (result.success ? pick(successBlurbs) : pick(failBlurbs)),
    timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
  }
}

function handleError(e) {
  const payload = e?.response?.data || {}
  const message = payload.error || e?.message || 'Falha na infiltração'
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
.burglary-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.burglary-hero {
  border-radius: 30px;
  padding: 30px;
  background: linear-gradient(135deg, rgba(12,18,38,0.95), rgba(5,10,20,0.9));
  border: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.hero-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.stat-card {
  min-width: 160px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}
.burglary-body {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 20px;
}
.panel {
  border-radius: 26px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(5,8,18,0.92);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.eyebrow.small { letter-spacing: 0.3em; font-size: 11px; }
.target-grid { display: flex; flex-direction: column; gap: 14px; }
.target-card {
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 20px;
  padding: 18px;
  background: rgba(255,255,255,0.01);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.target-card.active {
  border-color: rgba(51,255,209,0.5);
  background: rgba(51,255,209,0.05);
}
.target-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.target-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 11px;
  color: var(--muted);
}
.badge {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
}
.target-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.schematic {
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
}
.schematic-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.chip {
  border-radius: 999px;
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.08);
  text-transform: uppercase;
  font-size: 11px;
}
.chip.active { border-color: rgba(51,255,209,0.9); background: rgba(51,255,209,0.09); }
.loadout-block { display: flex; flex-direction: column; gap: 6px; }
.phase-list { display: flex; flex-direction: column; gap: 10px; }
.phase-list article {
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 12px;
  background: rgba(255,255,255,0.01);
}
.phase-list header { display: flex; justify-content: space-between; font-size: 13px; }
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(160px,1fr));
  gap: 14px;
}
.meter-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
}
.meter-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), #3b82f6);
}
.risk-chip {
  display: inline-flex;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08);
}
.full { width: 100%; }
.result {
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 16px;
  background: rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.result-meta {
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
.timeline ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.timeline li {
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
@media (max-width: 1200px) {
  .burglary-body { grid-template-columns: 1fr; }
}
</style>
