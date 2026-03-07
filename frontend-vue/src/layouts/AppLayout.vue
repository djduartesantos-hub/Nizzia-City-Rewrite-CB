<template>
  <div class="app-shell">
    <div class="app-sheen" aria-hidden="true">
      <AmbientField />
      <span class="orb orb--one"></span>
      <span class="orb orb--two"></span>
      <span class="orb orb--three"></span>
      <div class="grid-overlay"></div>
    </div>
    <Topbar />
    <div class="app-wrap">
      <Sidebar />
      <main class="main-content">
        <div class="content-section">
          <slot />
        </div>
        <AppFooter />
      </main>
    </div>
  </div>
  
</template>

<script setup>
import Topbar from '../components/Topbar.vue'
import Sidebar from '../components/Sidebar.vue'
import AppFooter from '../components/AppFooter.vue'
import AmbientField from '../components/AmbientField.vue'
import '../assets/layout.css'
</script>

<style scoped>
/* Layout styling largely in layout.css */
</style>
