<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { IconName } from '@/utils/icons'

defineProps<{
  label: string
  value: number | string | null
  iconName?: IconName
  variant?: 'indigo' | 'green' | 'yellow'
}>()

const variantIcon: Record<string, string> = {
  indigo: 'text-indigo-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ label }}</span>
      <AppIcon
        v-if="iconName"
        :name="iconName"
        class="h-4 w-4 shrink-0"
        :class="variantIcon[variant ?? 'indigo']"
      />
    </div>
    <div v-if="value !== null" class="text-2xl font-bold text-gray-900 mt-1">{{ value }}</div>
    <div v-else class="mt-1 h-7 w-16 rounded bg-gray-100 animate-pulse" />
  </div>
</template>
