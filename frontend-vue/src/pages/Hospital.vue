<template>
  <section class="hospital-view">
    <header class="hero">
      <div>
        <p class="eyebrow">Rede Municipal de Saúde</p>
        <h1>Hospital São Nizzia</h1>
        <p class="subtitle">Supervisiona pacientes críticos, aplica tratamentos relâmpago e coordena revives premium para voltar ao combate.</p>
      </div>
      <div class="stat-group">
        <div class="stat-card">
          <span class="label">Pacientes ativos</span>
          <strong>{{ stats.total }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Tempo médio</span>
          <strong>{{ formatDuration(stats.avgSeconds || 0) }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Último revive</span>
          <strong>{{ stats.lastRevive ? fmt(stats.lastRevive) : '—' }}</strong>
        </div>
      </div>
    </header>

    <section class="walkin-section">
      <div class="walkin-card">
        <header>
          <div>
            <p class="eyebrow">Auto-tratamento</p>
            <h2>Clínica Walk-In</h2>
            <p class="muted">
              Recupera HP sem internação. Valores variam conforme a pressão da ala de internação e o volume de tratamentos recentes.
            </p>
          </div>
          <button class="ghost" @click="loadWalkInQuote" :disabled="walkIn.loading">
            <span v-if="walkIn.loading">Recalculando…</span>
            <span v-else>Atualizar cotação</span>
          </button>
        </header>
        <div v-if="walkIn.loading" class="walkin-state">Calculando cotação com base nos últimos {{ walkInWindowSeconds }} segundos…</div>
        <div v-else-if="walkIn.error" class="walkin-state error">{{ walkIn.error }}</div>
        <div v-else-if="!walkIn.quote" class="walkin-state">Solicita uma nova cotação para desbloquear o tratamento.</div>
        <div v-else class="walkin-body">
          <div class="walkin-grid">
            <div class="walkin-stat">
              <label>HP atual</label>
              <strong>{{ walkIn.quote.currentHealth }} / {{ walkIn.quote.targetHealth }}</strong>
              <small>Faltam {{ walkIn.quote.missingHp }} HP para o alvo</small>
            </div>
            <div class="walkin-stat">
              <label>Recuperação planejada</label>
              <strong>+{{ walkIn.quote.hpToRecover }} HP</strong>
              <small>Limite por sessão: {{ walkIn.quote.maxHpPerSession }} HP</small>
            </div>
            <div class="walkin-stat">
              <label>Custo total</label>
              <strong>{{ formatMoney(walkIn.quote.totalCost) }}</strong>
              <small>{{ formatMoney(walkIn.quote.perHpCost) }} por HP</small>
            </div>
            <div class="walkin-stat">
              <label>Duração estimada</label>
              <strong>{{ formatDuration(walkIn.quote.totalSeconds) }}</strong>
              <small>{{ walkInPerHpSecondsLabel }} por HP</small>
            </div>
            <div class="walkin-stat">
              <label>Pressão assistencial</label>
              <strong>{{ walkIn.quote.patientLoad }} pacientes</strong>
              <small>{{ walkIn.quote.treatmentsThisWindow }} tratamentos nesta janela</small>
            </div>
            <div class="walkin-stat">
              <label>Recalibração</label>
              <strong>{{ walkInBucketRemaining ? formatCountdown(walkInBucketRemaining) : 'A qualquer momento' }}</strong>
              <small>
                Janela {{ walkInWindowMinutes }} min termina em
                {{ walkIn.quote?.bucket?.endsAt ? fmt(walkIn.quote.bucket.endsAt) : '—' }}
              </small>
            </div>
          </div>
          <div class="walkin-footer">
            <div class="walkin-flags">
              <span v-if="walkIn.hasCooldown" class="pill warn">
                Cooldown ativo · {{ formatCountdown(walkIn.cooldownRemaining) }}
              </span>
              <span v-else-if="walkIn.quote.hpToRecover <= 0" class="pill ok">Vida no alvo</span>
              <span v-else-if="!walkIn.canAfford" class="pill warn">Saldo insuficiente</span>
              <span v-else class="pill info">Pressão {{ walkInPressureLabel }}</span>
            </div>
            <button @click="startWalkInTreatmentAction" :disabled="walkInButtonDisabled">
              {{ walkInButtonLabel }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="filters">
      <div class="field">
        <label>Pesquisar</label>
        <input v-model.trim="filters.search" type="text" placeholder="Nome, gang ou causa" />
      </div>
      <div class="field">
        <label>Gang</label>
        <select v-model="filters.gang">
          <option value="all">Todas</option>
          <option v-for="tag in gangOptions" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </div>
      <div class="field">
        <label>Ordenar por</label>
        <select v-model="filters.sort">
          <option value="time_desc">Mais tempo restante</option>
          <option value="time_asc">Menos tempo restante</option>
          <option value="level_desc">Nível elevado</option>
          <option value="level_asc">Nível baixo</option>
          <option value="health_asc">Menos saúde</option>
        </select>
      </div>
      <div class="field">
        <label>Auto-refresh</label>
        <select v-model.number="autoRefreshSeconds">
          <option :value="0">Manual</option>
          <option :value="30">30s</option>
          <option :value="60">60s</option>
          <option :value="120">2 min</option>
        </select>
      </div>
      <button class="ghost" @click="loadPatients" :disabled="loading">
        <span v-if="loading">Atualizando…</span>
        <span v-else>Atualizar agora</span>
      </button>
    </div>

    <div class="content-grid">
      <div class="list-panel">
        <div v-if="loading" class="empty">Carregando pacientes…</div>
        <div v-else-if="errorMessage" class="empty error">{{ errorMessage }}</div>
        <div v-else-if="!patients.length" class="empty">Nenhum paciente internado.</div>
        <div v-else class="patient-list">
          <article
            v-for="patient in patients"
            :key="patient.userId"
            class="patient-card"
            :class="{ selected: selectedPatient?.userId === patient.userId, critical: patient.health < 250 }"
            @click="selectPatient(patient)"
          >
            <header>
              <div>
                <strong>{{ patient.name }}</strong>
                <span class="muted">#{{ patient.id }}</span>
              </div>
              <span class="timer">{{ formatCountdown(patient.remainingSeconds) }}</span>
            </header>
            <div class="tags">
              <span class="pill cause">{{ patient.cause || 'Causa desconhecida' }}</span>
              <span class="pill gang" v-if="patient.gang">{{ patient.gang }}</span>
            </div>
            <p class="muted">HP {{ patient.health }} · internado desde {{ fmt(patient.lastDamageAt) || '—' }}</p>
          </article>
        </div>
        <div class="pagination" v-if="patients.length">
          <button class="ghost" :disabled="pagination.page === 1 || loading" @click="changePage(-1)">Anterior</button>
          <span>Página {{ pagination.page }}</span>
          <button class="ghost" :disabled="!pagination.hasMore || loading" @click="changePage(1)">Próxima</button>
        </div>
      </div>

      <div class="detail-panel">
        <div v-if="!selectedPatient" class="empty">
          Seleciona um paciente para ver dados vitais e agir.
        </div>
        <div v-else class="detail-card">
          <header>
            <h2>{{ selectedPatient.name }}</h2>
            <p class="muted">Causa: {{ selectedPatient.cause || '—' }}</p>
          </header>
          <div class="detail-grid">
            <div>
              <label>Tempo restante</label>
              <strong>{{ formatCountdown(selectedPatient.remainingSeconds) }}</strong>
            </div>
            <div>
              <label>HP atual</label>
              <strong>{{ selectedPatient.health }}</strong>
            </div>
            <div>
              <label>Gang</label>
              <strong>{{ selectedPatient.gang || 'Independente' }}</strong>
            </div>
            <div>
              <label>Custo revive</label>
              <strong>${{ selectedPatient.reviveCost?.toLocaleString?.() || '—' }}</strong>
            </div>
          </div>
          <div class="actions">
            <label class="treat-label">
              Redução
              <select v-model.number="treatSeconds">
                <option v-for="opt in treatOptions" :key="opt" :value="opt">-{{ Math.round(opt / 60) }} min</option>
              </select>
            </label>
            <button @click="treatPatientAction" :disabled="actionState.treat">{{ actionState.treat ? 'Tratando…' : 'Aplicar tratamento' }}</button>
            <button class="secondary" @click="revivePatientAction" :disabled="actionState.revive || !selectedPatient.reviveCost">
              {{ actionState.revive ? 'Processando…' : 'Reviver agora' }}
            </button>
            <button class="ghost" @click="openInAdmin" :disabled="!selectedPatient?.userId">Abrir no Admin</button>
          </div>
          <section class="history">
            <div class="history-row" v-for="entry in selectedPatient.history || []" :key="entry.id || entry.ts">
              <span>{{ fmt(entry.ts) }}</span>
              <p>{{ entry.text }}</p>
            </div>
            <div v-if="!(selectedPatient.history || []).length" class="muted">Sem eventos recentes.</div>
          </section>
        </div>
      </div>

      <aside class="events-panel">
        <header>
          <h3>Eventos Clínicos</h3>
          <button class="ghost" @click="loadEvents" :disabled="eventsLoading">Atualizar</button>
        </header>
        <div v-if="eventsLoading" class="empty">Carregando feed…</div>
        <div v-else-if="!events.length" class="empty">Sem ocorrências nas últimas horas.</div>
        <ul v-else class="events-list">
          <li v-for="event in events" :key="event.id || event.ts">
            <p>{{ event.summary }}</p>
            <span class="muted">{{ fmt(event.ts) }}</span>
          </li>
        </ul>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/client'
import { useToast } from '../composables/useToast'
import { fmtDate as fmt } from '../utils/format'

const toast = useToast()
const router = useRouter()
const DEFAULT_WALKIN_WINDOW_SECONDS = 1800

const patients = ref([])
const stats = ref({ total: 0, avgSeconds: 0, lastRevive: null })
const events = ref([])
const eventsLoading = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const selectedPatient = ref(null)
const filters = ref({ search: '', gang: 'all', sort: 'time_desc' })
const pagination = ref({ page: 1, limit: 20, hasMore: false })
const gangOptions = computed(() => {
  const tags = new Set()
  for (const p of patients.value) {
    if (p.gang) tags.add(p.gang)
  }
  return Array.from(tags).sort()
})
const actionState = ref({ treat: false, revive: false })
const treatOptions = [120, 180, 300, 480]
const treatSeconds = ref(180)
const autoRefreshSeconds = ref(60)
let autoRefreshTimer = null
const walkIn = reactive({
  loading: false,
  error: '',
  quote: null,
  cooldownRemaining: 0,
  canAfford: false,
  hasCooldown: false,
})
const walkInAction = ref(false)
const walkInBucketRemaining = ref(0)
let walkInCountdownTimer = null
const walkInWindowSeconds = computed(() => {
  const raw = walkIn.quote?.bucket?.intervalSeconds
  return Math.max(60, Number(raw) || DEFAULT_WALKIN_WINDOW_SECONDS)
})
const walkInWindowMinutes = computed(() => Math.max(1, Math.round(walkInWindowSeconds.value / 60)))
const walkInPerHpSecondsLabel = computed(() => formatSecondsLabel(walkIn.quote?.perHpSeconds))
const walkInPressureLabel = computed(() => formatDecimal(walkIn.quote?.pressureScore))

function formatDuration(seconds){
  const s = Math.max(0, Number(seconds) || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return `${h}h ${m}m`
  const min = Math.max(1, m)
  return `${min}m`
}

function formatCountdown(seconds){
  const total = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (total >= 3600) {
    const h = Math.floor(total / 3600)
    return `${pad(h)}:${pad(m % 60)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

function formatMoney(value){
  const amount = Math.max(0, Number(value) || 0)
  return `$${amount.toLocaleString()}`
}

function formatDecimal(value, digits = 2){
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return num.toFixed(digits)
}

function formatSecondsLabel(value){
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  if (num >= 1) return `${num.toFixed(2)}s`
  return `${(num * 1000).toFixed(0)}ms`
}

function buildQuery(){
  const params = new URLSearchParams()
  if (filters.value.search) params.set('q', filters.value.search)
  if (filters.value.gang !== 'all') params.set('gang', filters.value.gang)
  params.set('sort', filters.value.sort)
  params.set('page', String(pagination.value.page))
  params.set('limit', String(pagination.value.limit))
  return params.toString()
}

async function loadPatients(){
  loading.value = true
  errorMessage.value = ''
  try {
    const query = buildQuery()
    const res = await api.get(`/world/patients?${query}`)
    patients.value = res.data?.patients || []
    stats.value = res.data?.stats || stats.value
    pagination.value.hasMore = !!res.data?.hasMore
    if (!selectedPatient.value && patients.value.length) {
      selectedPatient.value = patients.value[0]
    } else if (selectedPatient.value) {
      const updated = patients.value.find((p) => p.userId === selectedPatient.value.userId)
      if (updated) selectedPatient.value = updated
    }
  } catch (e) {
    patients.value = []
    errorMessage.value = e?.response?.data?.error || e?.message || 'Falha ao carregar pacientes'
  } finally {
    loading.value = false
  }
}

function selectPatient(patient){
  selectedPatient.value = patient
}

function changePage(delta){
  pagination.value.page = Math.max(1, pagination.value.page + delta)
  loadPatients()
}

function openInAdmin(){
  if (!selectedPatient.value) return
  try {
    if (selectedPatient.value.userId) {
      localStorage.setItem('nc_target_uid', selectedPatient.value.userId)
    }
    if (selectedPatient.value.id) {
      localStorage.setItem('nc_target_pid', String(selectedPatient.value.id))
    }
  } catch {}
  router.push({ name: 'admin' })
}

function clearWalkInCountdown(){
  if (walkInCountdownTimer) {
    clearInterval(walkInCountdownTimer)
    walkInCountdownTimer = null
  }
}

function updateWalkInCountdown(){
  if (walkIn.cooldownRemaining > 0) {
    walkIn.cooldownRemaining = Math.max(0, walkIn.cooldownRemaining - 1)
    if (walkIn.cooldownRemaining === 0) walkIn.hasCooldown = false
  }
  const endsAt = walkIn.quote?.bucket?.endsAt ? new Date(walkIn.quote.bucket.endsAt).getTime() : null
  if (!endsAt) {
    walkInBucketRemaining.value = 0
    return
  }
  const diff = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
  walkInBucketRemaining.value = diff
  if (diff <= 0 && !walkIn.loading) {
    loadWalkInQuote()
  }
}

function scheduleWalkInCountdown(){
  clearWalkInCountdown()
  if (!walkIn.quote) {
    walkInBucketRemaining.value = 0
    return
  }
  updateWalkInCountdown()
  walkInCountdownTimer = setInterval(updateWalkInCountdown, 1000)
}

async function loadWalkInQuote(){
  walkIn.loading = true
  walkIn.error = ''
  try {
    const res = await api.get('/world/hospital/walk-in/quote')
    walkIn.quote = res.data?.quote || null
    walkIn.cooldownRemaining = Math.max(0, Number(res.data?.cooldownRemaining) || 0)
    walkIn.canAfford = !!res.data?.canAfford
    walkIn.hasCooldown = !!res.data?.hasCooldown
    if (!walkIn.quote) {
      walkIn.error = 'Sem cotação disponível.'
      clearWalkInCountdown()
    } else {
      scheduleWalkInCountdown()
    }
  } catch (e) {
    walkIn.quote = null
    walkIn.canAfford = false
    walkIn.hasCooldown = false
    walkIn.cooldownRemaining = 0
    walkIn.error = e?.response?.data?.error || e?.message || 'Falha ao calcular cotação'
    clearWalkInCountdown()
  } finally {
    walkIn.loading = false
  }
}

const walkInButtonDisabled = computed(() => {
  if (walkIn.loading || walkInAction.value) return true
  if (!walkIn.quote) return true
  if (walkIn.hasCooldown) return true
  if (walkIn.quote.hpToRecover <= 0) return true
  if (!walkIn.canAfford) return true
  return false
})

const walkInButtonLabel = computed(() => {
  if (walkIn.loading) return 'Calculando…'
  if (walkInAction.value) return 'Aplicando…'
  if (!walkIn.quote) return 'Solicita cotação'
  if (walkIn.hasCooldown) return `Cooldown · ${formatCountdown(walkIn.cooldownRemaining)}`
  if (walkIn.quote.hpToRecover <= 0) return 'Vida completa'
  if (!walkIn.canAfford) return 'Saldo insuficiente'
  return `Tratar por ${formatMoney(walkIn.quote.totalCost)}`
})

async function treatPatientAction(){
  if (!selectedPatient.value) return
  actionState.value.treat = true
  try {
    const payload = { targetUserId: selectedPatient.value.userId, seconds: treatSeconds.value }
    const res = await api.post('/world/hospital/treat', payload)
    toast.ok(res.data?.message || 'Tratamento aplicado')
    await loadPatients()
    await loadEvents()
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao tratar')
  } finally {
    actionState.value.treat = false
  }
}

async function revivePatientAction(){
  if (!selectedPatient.value?.reviveCost) return
  actionState.value.revive = true
  try {
    const payload = { targetUserId: selectedPatient.value.userId }
    const res = await api.post('/world/hospital/revive', payload)
    toast.ok(res.data?.message || 'Revive concluído')
    await loadPatients()
    await loadEvents()
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao reviver')
  } finally {
    actionState.value.revive = false
  }
}

async function loadEvents(){
  eventsLoading.value = true
  try {
    const res = await api.get('/world/hospital/events?limit=10')
    events.value = res.data?.events || []
  } catch (e) {
    events.value = []
    toast.error(e?.response?.data?.error || e?.message || 'Feed indisponível')
  } finally {
    eventsLoading.value = false
  }
}

async function startWalkInTreatmentAction(){
  if (walkInButtonDisabled.value || walkInAction.value) return
  walkInAction.value = true
  try {
    const res = await api.post('/world/hospital/walk-in')
    toast.ok(res.data?.message || 'Tratamento iniciado')
    await loadWalkInQuote()
    await loadEvents()
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao iniciar tratamento')
  } finally {
    walkInAction.value = false
  }
}

function setupAutoRefresh(){
  clearInterval(autoRefreshTimer)
  if (!autoRefreshSeconds.value) return
  autoRefreshTimer = setInterval(() => {
    loadPatients()
  }, autoRefreshSeconds.value * 1000)
}

onMounted(async () => {
  await Promise.all([loadPatients(), loadEvents()])
  await loadWalkInQuote()
  setupAutoRefresh()
})

onBeforeUnmount(() => {
  clearInterval(autoRefreshTimer)
  clearWalkInCountdown()
})

watch(() => ({ ...filters.value }), () => {
  pagination.value.page = 1
  loadPatients()
})

watch(autoRefreshSeconds, () => {
  setupAutoRefresh()
})
</script>

<style scoped>
.hospital-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px 64px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--muted);
}
.hero h1 {
  margin: 4px 0;
  font-size: 2rem;
}
.subtitle {
  max-width: 520px;
  color: var(--muted);
}
.stat-group {
  display: flex;
  gap: 12px;
}
.stat-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 140px;
}
.stat-card .label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 4px;
}
.stat-card strong {
  font-size: 20px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  align-items: end;
}
.filters .field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
input, select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: inherit;
}
button {
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s ease;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
button.secondary {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
}
button.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}
.content-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.2fr 0.7fr;
  gap: 20px;
  align-items: flex-start;
}
.list-panel, .detail-panel, .events-panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  min-height: 320px;
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 32px 16px;
}
.empty.error {
  color: var(--danger);
}
.patient-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.patient-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--panel-alt, #151820);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.patient-card.selected {
  border-color: var(--accent);
  transform: translateX(4px);
}
.patient-card.critical {
  box-shadow: 0 0 0 1px rgba(255, 82, 82, 0.3);
}
.patient-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.muted {
  color: var(--muted);
  font-size: 0.85rem;
}
.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.pill {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pill.cause {
  background: rgba(255, 163, 72, 0.15);
  color: #ffa348;
}
.pill.gang {
  background: rgba(94, 234, 212, 0.15);
  color: #5eead4;
}
.pill.warn {
  background: rgba(255, 196, 0, 0.15);
  color: #facc15;
}
.pill.ok {
  background: rgba(110, 231, 183, 0.18);
  color: #22c55e;
}
.pill.info {
  background: rgba(125, 211, 252, 0.18);
  color: #38bdf8;
}
.timer {
  font-family: 'JetBrains Mono', monospace;
}
.walkin-section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
}
.walkin-card > header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.walkin-state {
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  margin-top: 16px;
}
.walkin-state.error {
  color: var(--danger);
}
.walkin-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}
.walkin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}
.walkin-stat {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  background: var(--panel-alt, rgba(20, 24, 33, 0.6));
}
.walkin-stat label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.walkin-stat strong {
  display: block;
  font-size: 20px;
  margin-top: 4px;
}
.walkin-stat small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
}
.walkin-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.walkin-flags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.detail-grid strong {
  font-size: 18px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.treat-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--muted);
}
.history {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.events-panel ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 0;
}
.events-panel li {
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}
@media (max-width: 1100px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
