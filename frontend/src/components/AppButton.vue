<script setup lang="ts">
defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  loading?: boolean
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="{
      'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500': (variant ?? 'primary') === 'primary',
      'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400': variant === 'secondary',
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500': variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
