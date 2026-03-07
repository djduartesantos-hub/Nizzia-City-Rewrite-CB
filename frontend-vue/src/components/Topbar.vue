<template>
  <div class="topbar">
    <div class="brand-block" @click="router.push('/')">
      <div class="brand-logo">NC</div>
      <div>
        <p class="brand-label">Nizzia City</p>
        <p class="brand-sub">Neon Underworld Command</p>
      </div>
    </div>

    <div class="topbar-news">
      <div class="ticker" :class="{ 'ticker--single': tickerMode==='single' }">
        <div class="ticker__track" :style="trackStyle">{{ tickerText }}</div>
      </div>
    </div>

    <div class="topbar-controls">
      <div class="quick-links">
        <button v-if="isAdmin" class="chip-btn chip-btn--accent" @click="goAdmin">
          <span>🛡</span><span>Admin</span>
        </button>
        <button
          v-for="link in quickLinks"
          :key="link.label"
          class="chip-btn"
          type="button"
          @click="link.handler()"
        >
          <span>{{ link.icon }}</span>
          <span>{{ link.label }}</span>
        </button>
      </div>
      <div class="control-actions">
        <button class="icon-btn" @click="toggleTheme" :title="isDark ? 'Switch to light' : 'Switch to dark'">
          <span v-if="isDark">🌤</span>
          <span v-else>🌙</span>
        </button>
        <div class="profile-chip" @click="goProfile" role="button">
          <span class="avatar">{{ playerInitials }}</span>
          <div class="profile-meta">
            <span class="profile-name">{{ store.player?.name || 'Agent' }}</span>
            <small class="profile-id">#{{ playerTag }}</small>
          </div>
        </div>
        <button class="icon-btn icon-btn--danger" @click="logout" title="Log out">⏻</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
// Note: do not import dev-only packages (like eslint configs) into runtime code

const router = useRouter()
const store = usePlayerStore()
const isAdmin = computed(() => {
  // Check role from store or cached player
  const role = store.player?.playerRole || (() => { try { return JSON.parse(localStorage.getItem('nc_player')||'null')?.playerRole } catch { return null } })()
  return role === 'Admin' || role === 'Developer'
})

function goAdmin(){
  router.push('/admin')
}
const hp = ref(0)
const playerInitials = computed(() => {
  const fallback = 'NC'
  const name = store.player?.name?.trim()
  if (!name) return fallback
  const parts = name.split(/\s+/).slice(0, 2)
  return parts.map(part => part.charAt(0).toUpperCase()).join('') || fallback
})
const playerTag = computed(() => store.player?.id ?? '—')

// ── Theme toggle ──
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')
function toggleTheme() {
  const next = isDark.value ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('nc_theme', next)
  isDark.value = next === 'dark'
}

// Ticker: simple rotation by default, with optional slow scroll
const tickerMode = ref('scroll') // 'single' | 'scroll'
const newsItems = ref([
  'Welcome to Nizzia City!',
  'Train in the gym to boost your stats.',
  'Happiness increases gym gains.',
  'Jobs pay out daily at 01:00 server time.',
  'Oscar is awesome!',
  'Lazy? Go and train!',
  'Bababing, bababing, bababing...',
  'AAAAHHHH!',
  'Drugs man, drugs!'
])
const idx = ref(0)
const tickerText = computed(() => tickerMode.value==='single' ? (newsItems.value[idx.value] || '') : newsItems.value.concat(newsItems.value).join(' — '))
const trackStyle = computed(() => tickerMode.value==='scroll' ? { animationDuration: '60s' } : { animation: 'none', paddingLeft: '0' })
const quickLinks = [
  { label: 'Wiki', icon: '📖', handler: openWiki },
  { label: 'Rules', icon: '⚖️', handler: rules },
  { label: 'Forums', icon: '💬', handler: forums },
  { label: 'Discord', icon: '🛰', handler: discord },
  { label: 'Staff', icon: '👥', handler: staff },
  { label: 'Credits', icon: '🎞', handler: credits }
]

let timer
onMounted(() => {
  // Load HP from cached player if present
  try {
    const p = JSON.parse(localStorage.getItem('nc_player')||'null')
    hp.value = typeof p?.health === 'number' ? p.health : 0
  } catch {}
  // Rotate ticker in single mode
  timer = setInterval(() => { if (tickerMode.value==='single') idx.value = (idx.value + 1) % newsItems.value.length }, 8000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

async function goProfile(){
  // Try store -> localStorage player -> fetch by user to resolve numeric Player.id
  const hasId = (v) => v !== undefined && v !== null
  let pid = store.player?.id
  if (!hasId(pid)) {
    try {
      const cached = JSON.parse(localStorage.getItem('nc_player') || 'null')
      pid = cached?.id
    } catch {}
  }
  if (!hasId(pid)) {
    try {
      const p = await store.loadByUser()
      pid = p?.id
    } catch {}
  }
  if (hasId(pid)) router.push(`/profile/${pid}`)
  else router.push('/profile')
}
function logout(){
  try { localStorage.removeItem('nc_token'); localStorage.removeItem('nc_user'); localStorage.removeItem('nc_player'); } catch {}
  router.push('/auth/login')
}

// Topbar action handlers (customize targets as you like)
function openWiki(){
  try { window.open('https://github.com/wklnd/Nizzia-City-Rewrite/wiki', '_blank') } catch {}
}
function rules(){
  // Route to News page as a placeholder for rules; replace with /rules when available
  router.push('/rules')
}
function forums(){
  try { window.open('https://forums.example.com', '_blank') } catch {}
}
function discord(){
  try { window.open('https://discord.gg/your-invite', '_blank') } catch {}
}
function staff(){
  // Placeholder; route somewhere relevant when a staff page exists
  router.push('/hall-of-fame')
}
function credits(){
  router.push('/credits')
}
</script>

<style scoped>
</style>
