<template>
  <section class="prison-view">
    <header class="hero">
      <div>
        <p class="eyebrow">Sistema Correccional</p>
        <h1>Prisão Central</h1>
        <p class="subtitle">Monitoriza detenções em tempo real, executa fugas calculadas ou negocia fianças estratégicas.</p>
      </div>
      <div class="stat-group">
        <div class="stat-card">
          <span class="label">Presos ativos</span>
          <strong>{{ stats.total }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Tempo médio</span>
          <strong>{{ formatDuration(stats.avgSeconds || 0) }}</strong>
        </div>
        <div class="stat-card">
          <span class="label">Última fuga</span>
          <strong>{{ stats.lastBreakout ? fmt(stats.lastBreakout) : '—' }}</strong>
        </div>
      </div>
    </header>

    <div class="filters">
      <div class="field">
        <label>Pesquisar</label>
        <input v-model.trim="filters.search" type="text" placeholder="Nome, gang ou crime" />
      </div>
      <div class="field">
        <label>Gang</label>
        <select v-model="filters.gang">
          <option value="all">Todas</option>
          <option v-for="tag in gangTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </div>
      <div class="field">
        <label>Ordenar por</label>
        <select v-model="filters.sort">
          <option value="time_desc">Mais tempo restante</option>
          <option value="time_asc">Menos tempo restante</option>
          <option value="severity_desc">Crimes graves</option>
          <option value="severity_asc">Crimes leves</option>
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
      <button class="ghost" @click="loadPrisoners" :disabled="loading">
        <span v-if="loading">Atualizando…</span>
        <span v-else>Atualizar agora</span>
      </button>
    </div>

    <div class="content-grid">
      <div class="list-panel">
        <div v-if="loading" class="empty">Carregando presos…</div>
        <div v-else-if="errorMessage" class="empty error">{{ errorMessage }}</div>
        <div v-else-if="!prisoners.length" class="empty">Nenhum preso no momento.</div>
        <div v-else class="inmate-list">
          <article
            v-for="inmate in prisoners"
            :key="inmate.userId"
            class="inmate-card"
            :class="{ selected: selectedPrisoner?.userId === inmate.userId }"
            @click="selectPrisoner(inmate)"
          >
            <header>
              <div>
                <strong>{{ inmate.name }}</strong>
                <span class="muted">#{{ inmate.id }}</span>
              </div>
              <span class="timer">{{ formatCountdown(inmate.remainingSeconds) }}</span>
            </header>
            <div class="tags">
              <span class="pill crime">{{ inmate.crime || 'Indefinido' }}</span>
              <span class="pill gang" v-if="inmate.gang">{{ inmate.gang }}</span>
            </div>
            <p class="muted">Detido por {{ inmate.arrestedBy || 'desconhecido' }} · {{ fmt(inmate.arrestedAt) }}</p>
          </article>
        </div>
        <div class="pagination" v-if="prisoners.length">
          <button class="ghost" :disabled="pagination.page === 1 || loading" @click="changePage(-1)">Anterior</button>
          <span>Página {{ pagination.page }}</span>
          <button class="ghost" :disabled="!pagination.hasMore || loading" @click="changePage(1)">Próxima</button>
        </div>
      </div>

      <div class="detail-panel">
        <div v-if="!selectedPrisoner" class="empty">
          Seleciona um preso para ver detalhes e agir.
        </div>
        <div v-else class="detail-card">
          <header>
            <h2>{{ selectedPrisoner.name }}</h2>
            <p class="muted">Crime: {{ selectedPrisoner.crime || '—' }}</p>
          </header>
          <div class="detail-grid">
            <div>
              <label>Tempo restante</label>
              <strong>{{ formatCountdown(selectedPrisoner.remainingSeconds) }}</strong>
            </div>
            <div>
              <label>Nível de segurança</label>
              <strong>{{ selectedPrisoner.security || 'Médio' }}</strong>
            </div>
            <div>
              <label>Custo fiança</label>
              <strong>${{ selectedPrisoner.bailCost?.toLocaleString?.() || '—' }}</strong>
            </div>
            <div>
              <label>Última tentativa</label>
              <strong>{{ selectedPrisoner.lastAttempt ? fmt(selectedPrisoner.lastAttempt) : 'Nunca' }}</strong>
            </div>
          </div>
          <div class="actions">
            <button @click="attemptBreakout" :disabled="actionState.breakout" title="Requer energia e arrisca falha">
              {{ actionState.breakout ? 'Tentando…' : 'Tentar fuga' }}
            </button>
            <button class="secondary" @click="payBail" :disabled="actionState.bail || !selectedPrisoner.bailCost">
              {{ actionState.bail ? 'Processando…' : 'Pagar fiança' }}
            </button>
          </div>
          <section class="history">
            <div class="history-row" v-for="entry in selectedPrisoner.history || []" :key="entry.id || entry.ts">
              <span>{{ fmt(entry.ts) }}</span>
              <p>{{ entry.text }}</p>
            </div>
            <div v-if="!(selectedPrisoner.history || []).length" class="muted">Sem histórico adicional.</div>
          </section>
        </div>
      </div>

      <aside class="events-panel">
        <header>
          <h3>Eventos Recentes</h3>
          <button class="ghost" @click="loadEvents" :disabled="eventsLoading">Atualizar</button>
        </header>
        <div v-if="eventsLoading" class="empty">Carregando feed…</div>
        <div v-else-if="!events.length" class="empty">Sem eventos nas últimas horas.</div>
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
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import api from '../api/client'
import { useToast } from '../composables/useToast'
import { fmtDate as fmt } from '../utils/format'

const toast = useToast()
const prisoners = ref([])
const stats = ref({ total: 0, avgSeconds: 0, lastBreakout: null })
const events = ref([])
const eventsLoading = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const selectedPrisoner = ref(null)
const filters = ref({ search: '', gang: 'all', sort: 'time_desc' })
const pagination = ref({ page: 1, limit: 20, hasMore: false })
const gangTags = ref(['Cartel Azul', 'Red Faction', 'Sombra'])
const actionState = ref({ breakout: false, bail: false })
const autoRefreshSeconds = ref(60)
let autoRefreshTimer = null

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

function buildQuery(){
  const params = new URLSearchParams()
  if (filters.value.search) params.set('q', filters.value.search)
  if (filters.value.gang !== 'all') params.set('gang', filters.value.gang)
  params.set('sort', filters.value.sort)
  params.set('page', String(pagination.value.page))
  params.set('limit', String(pagination.value.limit))
  return params.toString()
}

async function loadPrisoners(){
  loading.value = true
  errorMessage.value = ''
  try {
    const query = buildQuery()
    const res = await api.get(`/world/prisoners?${query}`)
    prisoners.value = res.data?.prisoners || []
    stats.value = res.data?.stats || stats.value
    pagination.value.hasMore = !!res.data?.hasMore
    if (!selectedPrisoner.value && prisoners.value.length) {
      selectedPrisoner.value = prisoners.value[0]
    } else if (selectedPrisoner.value) {
      const updated = prisoners.value.find((p) => p.userId === selectedPrisoner.value.userId)
      if (updated) selectedPrisoner.value = updated
    }
  } catch (e) {
    prisoners.value = []
    errorMessage.value = e?.response?.data?.error || e?.message || 'Falha ao carregar presos'
  } finally {
    loading.value = false
  }
}

function selectPrisoner(inmate){
  selectedPrisoner.value = inmate
}

function changePage(delta){
  pagination.value.page = Math.max(1, pagination.value.page + delta)
  loadPrisoners()
}

async function attemptBreakout(){
  if (!selectedPrisoner.value) return
  actionState.value.breakout = true
  try {
    const payload = { targetUserId: selectedPrisoner.value.userId }
    const res = await api.post('/world/prison/assist', payload)
    toast.success(res.data?.message || 'Tentativa registrada')
    await loadPrisoners()
    await loadEvents()
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Fuga falhou')
  } finally {
    actionState.value.breakout = false
  }
}

async function payBail(){
  if (!selectedPrisoner.value?.bailCost) return
  actionState.value.bail = true
  try {
    const payload = { targetUserId: selectedPrisoner.value.userId }
    const res = await api.post('/world/prison/bail', payload)
    toast.success(res.data?.message || 'Fiança paga com sucesso')
    await loadPrisoners()
    await loadEvents()
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao pagar fiança')
  } finally {
    actionState.value.bail = false
  }
}

async function loadEvents(){
  eventsLoading.value = true
  try {
    const res = await api.get('/world/prison/events?limit=10')
    events.value = res.data?.events || []
  } catch (e) {
    events.value = []
    toast.error(e?.response?.data?.error || e?.message || 'Feed indisponível')
  } finally {
    eventsLoading.value = false
  }
}

function setupAutoRefresh(){
  clearInterval(autoRefreshTimer)
  if (!autoRefreshSeconds.value) return
  autoRefreshTimer = setInterval(() => {
    loadPrisoners()
  }, autoRefreshSeconds.value * 1000)
}

onMounted(async () => {
  await Promise.all([loadPrisoners(), loadEvents()])
  setupAutoRefresh()
})

onBeforeUnmount(() => {
  clearInterval(autoRefreshTimer)
})

watch(() => ({ ...filters.value }), () => {
  pagination.value.page = 1
  loadPrisoners()
})

watch(autoRefreshSeconds, () => {
  setupAutoRefresh()
})
</script>

<style scoped>
.prison-view {
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
  color: var(--muted);
  letter-spacing: 0.04em;
}
input,
select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.04);
  color: var(--text);
}
button {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  padding: 9px 16px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
}
button.secondary {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}
button.ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--text);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.content-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr 0.6fr;
  gap: 20px;
}
.list-panel,
.detail-panel,
.events-panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  min-height: 420px;
}
.inmate-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.inmate-card {
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  transition: border 0.2s, transform 0.2s;
}
.inmate-card.selected {
  border-color: var(--accent);
  transform: translateX(4px);
}
.inmate-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.timer {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 6px 0 4px;
}
.pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  text-transform: uppercase;
}
.pill.crime {
  background: rgba(255,94,94,0.15);
  color: #ff9a9a;
}
.pill.gang {
  background: rgba(148,187,233,0.15);
  color: #9fc3ff;
}
.muted {
  color: var(--muted);
  font-size: 12px;
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 30px 0;
}
.empty.error {
  color: #ff9090;
}
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}
.detail-card header {
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: 12px;
  margin-bottom: 12px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.detail-grid label {
  font-size: 10px;
}
.actions {
  display: flex;
  gap: 10px;
  margin: 16px 0 12px;
}
.history {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow: auto;
}
.history-row {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 6px;
}
.events-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.events-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.events-list li {
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 8px;
}
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  .events-panel {
    order: 3;
  }
}
</style>
