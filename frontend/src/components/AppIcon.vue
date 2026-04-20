<script setup lang="ts">
import { ICONS } from '@/utils/icons'
import type { IconName } from '@/utils/icons'

const props = defineProps<{ name: IconName }>()
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
    v-html="ICONS[props.name]"
  />
</template>
