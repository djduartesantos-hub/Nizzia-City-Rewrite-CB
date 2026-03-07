<template>
  <canvas ref="canvas" class="ambient-canvas" aria-hidden="true"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvas = ref(null)
let ctx
let particles = []
let rafId
let resizeObserver

const CONFIG = {
  count: 70,
  maxSize: 2.2,
  minSize: 0.6,
  maxSpeed: 0.35,
  connectionDistance: 160
}

function createParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * CONFIG.maxSpeed,
    vy: (Math.random() - 0.5) * CONFIG.maxSpeed,
    size: CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize),
    hue: 190 + Math.random() * 120
  }
}

function initParticles(width, height) {
  particles = Array.from({ length: CONFIG.count }, () => createParticle(width, height))
}

function update(width, height) {
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy

    if (p.x > width) p.x = 0
    else if (p.x < 0) p.x = width

    if (p.y > height) p.y = 0
    else if (p.y < 0) p.y = height
  }
}

function render(width, height) {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  // Trails background
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'rgba(255, 138, 214, 0.06)')
  gradient.addColorStop(1, 'rgba(124, 245, 255, 0.04)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Connections
  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i]
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j]
      const dx = p1.x - p2.x
      const dy = p1.y - p2.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < CONFIG.connectionDistance) {
        const alpha = 1 - dist / CONFIG.connectionDistance
        ctx.strokeStyle = `rgba(124, 245, 255, ${alpha * 0.25})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }
  }

  // Particles
  for (const p of particles) {
    const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6)
    radial.addColorStop(0, `hsla(${p.hue}, 90%, 70%, 0.9)`)
    radial.addColorStop(1, `hsla(${p.hue}, 90%, 70%, 0)`)
    ctx.fillStyle = radial
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 6, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop(width, height) {
  update(width, height)
  render(width, height)
  rafId = requestAnimationFrame(() => loop(width, height))
}

function setupCanvas() {
  const el = canvas.value
  if (!el) return
  const dpr = window.devicePixelRatio || 1
  const rect = el.getBoundingClientRect()
  el.width = rect.width * dpr
  el.height = rect.height * dpr
  ctx = el.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  initParticles(rect.width, rect.height)
  cancelAnimationFrame(rafId)
  loop(rect.width, rect.height)
}

onMounted(() => {
  setupCanvas()
  resizeObserver = new ResizeObserver(() => setupCanvas())
  if (canvas.value) resizeObserver.observe(canvas.value)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeObserver && canvas.value) resizeObserver.unobserve(canvas.value)
})
</script>

<style scoped>
.ambient-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.45;
  filter: saturate(1.4);
}
</style>
