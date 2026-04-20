<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  segments: Array<{ label: string; value: number; color: string }>
}>()

// outer r=80, inner r=48 (60% of 80), stroke=32, midpoint r=64
const R = 64
const CX = 100
const CY = 100
const SW = 32
const CIRC = 2 * Math.PI * R

const total = computed(() => props.segments.reduce((sum, s) => sum + s.value, 0))

const arcs = computed(() => {
  if (total.value === 0) return []
  let offsetFraction = 0
  return props.segments.map((s) => {
    const fraction = s.value / total.value
    const dashArray = `${fraction * CIRC} ${CIRC}`
    const dashOffset = -offsetFraction * CIRC
    offsetFraction += fraction
    return { label: s.label, value: s.value, color: s.color, dashArray, dashOffset }
  })
})
</script>

<template>
  <svg viewBox="0 0 200 200" role="img" :aria-label="`Poll results — ${total} total votes`">
    <!-- Gray base ring -->
    <circle :cx="CX" :cy="CY" :r="R" fill="none" stroke="#e5e7eb" :stroke-width="SW" />
    <!-- Colored segments -->
    <circle
      v-for="(arc, i) in arcs"
      :key="i"
      :cx="CX" :cy="CY" :r="R"
      fill="none"
      :stroke="arc.color"
      :stroke-width="SW"
      :stroke-dasharray="arc.dashArray"
      :stroke-dashoffset="arc.dashOffset"
      transform="rotate(-90 100 100)"
      stroke-linecap="butt"
    >
      <title>{{ arc.label }}: {{ arc.value }} vote{{ arc.value !== 1 ? 's' : '' }}</title>
    </circle>
    <!-- Center: total count -->
    <text
      :x="CX" :y="CY - 5"
      text-anchor="middle"
      dominant-baseline="auto"
      font-size="24"
      font-weight="700"
      fill="#111827"
    >{{ total }}</text>
    <text
      :x="CX" :y="CY + 13"
      text-anchor="middle"
      dominant-baseline="auto"
      font-size="11"
      fill="#9ca3af"
    >votes</text>
  </svg>
</template>
