<template>
  <section class="inventory-page">
    <header class="inventory-hero">
      <div>
        <p class="eyebrow">Loadout atual</p>
        <h2>{{ store.player?.name || 'Inventário' }}</h2>
        <p class="muted">Equipamentos equipados, consumíveis e colecionáveis organizados para ação rápida.</p>
      </div>
      <div class="hero-stats">
        <div class="stat">
          <span>Itens únicos</span>
          <strong>{{ inventoryStats.unique }}</strong>
        </div>
        <div class="stat">
          <span>Total (qty)</span>
          <strong>{{ inventoryStats.totalQty }}</strong>
        </div>
        <div class="stat">
          <span>Usáveis</span>
          <strong>{{ usableCount }}</strong>
        </div>
      </div>
    </header>

    <section class="loadout-card">
      <div
        class="slot"
        v-for="slot in equippedSlots"
        :key="slot.key"
      >
        <div class="slot-icon" :class="{ filled: !!slot.entry }">{{ slot.icon }}</div>
        <div class="slot-details">
          <p class="slot-label">{{ slot.label }}</p>
          <p v-if="slot.entry" class="slot-name">{{ slot.entry.item.name }}</p>
          <p v-else class="muted">Nada equipado</p>
          <small v-if="slot.entry" class="slot-meta">{{ statSummary(slot.entry.item) || 'Sem atributos' }}</small>
        </div>
      </div>
    </section>

    <section class="inventory-panel">
      <div class="inventory-toolbar">
        <div class="category-chips">
          <button
            v-for="cat in categories"
            :key="cat.key"
            class="chip"
            :class="{ active: selectedCategory === cat.key }"
            @click="selectedCategory = cat.key"
          >
            {{ cat.label }}<span v-if="cat.count !== undefined"> ({{ cat.count }})</span>
          </button>
        </div>
        <input
          class="search"
          type="search"
          v-model.trim="q"
          placeholder="Filtrar por nome"
        />
      </div>

      <div v-if="loading" class="panel-state">
        <div class="spinner"></div>
        <p>Carregando inventário…</p>
      </div>
      <div v-else-if="filtered.length === 0" class="panel-state empty">
        Nenhum item encontrado para este filtro.
      </div>
      <div v-else class="inventory-grid">
        <article
          class="item-card"
          v-for="entry in filtered"
          :key="entry.item._id || entry.item.id"
        >
          <header>
            <div class="item-pill">
              <span class="icon">{{ iconForType(entry.item.type) }}</span>
              <div>
                <strong>{{ entry.item.name }}</strong>
                <small>{{ labelForType(entry.item.type) }}</small>
              </div>
            </div>
            <span class="qty">x{{ entry.qty }}</span>
          </header>
          <p class="item-desc" v-if="entry.item.description">{{ entry.item.description }}</p>
          <p class="item-meta" v-if="statSummary(entry.item)">{{ statSummary(entry.item) }}</p>
          <p class="item-meta warn" v-if="cooldownHours(entry.item) !== null">
            Cooldown: {{ cooldownHours(entry.item) }}h
          </p>
          <div class="card-actions">
            <button
              class="btn btn--primary"
              :disabled="!entry.item.usable || busy"
              @click="useOne(entry)"
            >Usar</button>
            <button class="btn" disabled>Enviar (em breve)</button>
            <button class="btn" disabled>Descartar</button>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../api/client'
import { usePlayer } from '../composables/usePlayer'
import { useToast } from '../composables/useToast'

const { store, ensurePlayer, reloadPlayer } = usePlayer()
const toast = useToast()

const inv = ref([])
const loading = ref(false)
const busy = ref(false)
const q = ref('')
const selectedCategory = ref('all')

const slotDefinitions = [
  { key: 'primaryWeapon', label: 'Arma primária', icon: '🔫' },
  { key: 'secondaryWeapon', label: 'Secundária', icon: '🎯' },
  { key: 'meleeWeapon', label: 'Corpo a corpo', icon: '🗡️' },
  { key: 'head', label: 'Cabeça', icon: '🪖' },
  { key: 'torso', label: 'Torso', icon: '🧥' },
  { key: 'pants', label: 'Pernas', icon: '👖' },
  { key: 'shoes', label: 'Calçado', icon: '🥾' },
  { key: 'legs', label: 'Acessório', icon: '🎒' },
]

const TYPE_LABELS = {
  weapon: 'Armas',
  armor: 'Armaduras',
  medicine: 'Medicinais',
  alchool: 'Álcool',
  enhancers: 'Boosters',
  clothes: 'Vestuário',
  tools: 'Ferramentas',
  drugs: 'Drogas',
  collectibles: 'Colecionáveis',
  cache: 'Caches',
  materials: 'Materiais',
}

function labelForType(t) {
  return TYPE_LABELS[t] || t || 'Outro'
}

const categories = computed(() => {
  const counts = inv.value.reduce((acc, entry) => {
    const type = entry?.item?.type || 'other'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
  const chips = Object.entries(counts).map(([key, count]) => ({ key, label: labelForType(key), count }))
  chips.sort((a, b) => a.label.localeCompare(b.label))
  return [{ key: 'all', label: 'Todos', count: inv.value.length }, ...chips]
})

const inventoryStats = computed(() => {
  const unique = inv.value.length
  const totalQty = inv.value.reduce((sum, entry) => sum + Number(entry.qty || 0), 0)
  return { unique, totalQty }
})

const usableCount = computed(() => inv.value.filter((entry) => entry?.item?.usable).length)

const equippedSlots = computed(() => {
  return slotDefinitions.map((slot) => {
    const entry = inv.value.find((e) => e?.item?.type2 === slot.key)
    return { ...slot, entry }
  })
})

const filtered = computed(() => {
  let list = inv.value
  if (selectedCategory.value !== 'all') {
    list = list.filter((entry) => (entry?.item?.type || 'other') === selectedCategory.value)
  }
  const term = q.value.trim().toLowerCase()
  if (term) {
    list = list.filter((entry) => (entry?.item?.name || '').toLowerCase().includes(term))
  }
  return list
})

function statSummary(item) {
  if (!item) return ''
  const tokens = []
  if (item.damage) tokens.push(`DMG ${item.damage}`)
  if (item.armor) tokens.push(`ARM ${item.armor}`)
  if (item.quality) tokens.push(`Qualidade ${item.quality}`)
  if (item.coverage && item.coverage !== 100) tokens.push(`${item.coverage}% cobertura`)
  return tokens.join(' · ')
}

function iconForType(type) {
  const map = {
    weapon: '🔫',
    armor: '🛡️',
    clothes: '🧥',
    medicine: '💉',
    drugs: '💊',
    enhancers: '⚡',
    tools: '🧰',
    collectibles: '🃏',
    cache: '📦',
  }
  return map[type] || '🎒'
}

async function loadInventory() {
  if (!store.player?.user) return
  loading.value = true
  try {
    const { data } = await api.get('/inventory/mine')
    inv.value = data?.inventory || []
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao carregar inventário')
  } finally {
    loading.value = false
  }
}

async function useOne(entry) {
  if (!store.player?.user) return
  busy.value = true
  try {
    const itemId = entry?.item?._id || entry?.item?.id
    await api.post('/inventory/use', { itemId, qty: 1 })
    await loadInventory()
    await reloadPlayer()
    toast.ok('Item usado')
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Falha ao usar item')
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await ensurePlayer()
  await loadInventory()
})

watch(
  () => store.player?.user,
  async (val, oldVal) => {
    if (val && val !== oldVal) await loadInventory()
  }
)

function cooldownHours(item) {
  const sec = Number(item?.effect?.cooldownSeconds || 0)
  if (!Number.isFinite(sec) || sec <= 0) return null
  const hours = sec / 3600
  if (hours >= 10) return Math.round(hours)
  return Math.round(hours * 10) / 10
}

</script>

<style scoped>
.inventory-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 60px;
}
.inventory-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 24px;
  background: radial-gradient(circle at top right, rgba(255,255,255,0.08), rgba(3,6,18,0.9));
}
.inventory-hero h2 {
  margin: 6px 0 0;
  font-size: 1.8rem;
}
.hero-stats {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.hero-stats .stat {
  min-width: 120px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 12px 16px;
  text-align: center;
  background: rgba(0,0,0,0.25);
}
.hero-stats span {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.hero-stats strong {
  font-size: 1.4rem;
}
.loadout-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
}
.slot {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  align-items: center;
}
.slot-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.slot-icon.filled {
  border-color: var(--accent);
  box-shadow: 0 0 10px rgba(255,255,255,0.08);
}
.slot-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0;
}
.slot-name {
  margin: 0;
  font-weight: 600;
}
.slot-meta {
  color: var(--muted);
}
.inventory-panel {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 20px;
  background: rgba(4,7,17,0.85);
}
.inventory-toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.category-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: inherit;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}
.chip.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.search {
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(0,0,0,0.3);
  color: var(--text);
  min-width: 200px;
}
.panel-state {
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
}
.panel-state.empty {
  font-size: 14px;
}
.spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.2);
  border-top-color: var(--accent);
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 14px;
}
.item-card {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 16px;
  background: rgba(255,255,255,0.02);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.item-pill {
  display: flex;
  gap: 10px;
  align-items: center;
}
.item-pill .icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.item-pill strong {
  margin: 0;
  font-size: 1rem;
}
.item-pill small {
  display: block;
  font-size: 11px;
  color: var(--muted);
}
.qty {
  font-weight: 600;
}
.item-desc {
  font-size: 13px;
  color: var(--text);
}
.item-meta {
  font-size: 12px;
  color: var(--muted);
}
.item-meta.warn {
  color: var(--warn);
}
.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.btn {
  border-radius: 999px;
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 640px) {
  .inventory-hero {
    flex-direction: column;
  }
  .inventory-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .search {
    width: 100%;
  }
}
</style>
