<template>
  <section class="city">
    <div class="city__head">
      <div>
        <h2>City Map</h2>
        <p class="muted">Navega no mapa tático e usa os quick links integrados para aceder a todas as páginas.</p>
      </div>
      <button class="btn" @click="openFullMap">Abrir city-map completo</button>
    </div>

    <div class="city__embed panel">
      <h3>City-map tático (novo)</h3>
      <iframe class="city__iframe" src="/city-map.html" title="City Map Tático" loading="lazy"></iframe>
    </div>

    <div class="city__links panel">
      <h3>Links das páginas</h3>
      <div class="city__links-grid">
        <RouterLink
          v-for="item in cityPageLinks"
          :key="item.to"
          class="city__link"
          :to="item.to"
        >
          <span class="city__link-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup>
import '../assets/city.css'

const cityPageLinks = [
  { to: '/inventory', label: 'Inventário', icon: '🎒' },
  { to: '/city-map', label: 'Cidade', icon: '🌆' },
  { to: '/prison', label: 'Prisão', icon: '🚔' },
  { to: '/hospital', label: 'Hospital', icon: '🏥' },
  { to: '/job', label: 'Emprego', icon: '💼' },
  { to: '/education', label: 'Educação', icon: '📚' },
  { to: '/gym', label: 'Ginásio', icon: '💪' },
  { to: '/casino', label: 'Cassino', icon: '🎰' },
  { to: '/stocks', label: 'Bolsa', icon: '📈' },
  { to: '/crimes', label: 'Crimes', icon: '⚠️' },
  { to: '/money', label: 'Finanças', icon: '💰' },
  { to: '/property', label: 'Propriedades', icon: '🏢' },
  { to: '/pets', label: 'Companheiros', icon: '🐾' },
  { to: '/market', label: 'Mercado', icon: '🛒' },
  { to: '/vault', label: 'Cofre', icon: '🔐' },
]

function openFullMap() {
  window.open('/city-map.html', '_blank', 'noopener')
}
</script>

<style scoped>
.city h2 { margin-top: 0; }
</style>
