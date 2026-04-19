<script setup lang="ts">
defineProps<{
  padding?: boolean
}>()
</script>

<template>
  <div
    class="rounded-lg border border-gray-200 bg-white shadow-sm"
    :class="{ 'p-4': padding !== false }"
  >
    <slot />
  </div>
</template>
