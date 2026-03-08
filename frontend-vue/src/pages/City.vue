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
  </section>
</template>

<script setup>
import '../assets/city.css'

function openFullMap() {
  window.open('/city-map.html', '_blank', 'noopener')
}
</script>

<style scoped>
.city h2 { margin-top: 0; }
</style>
