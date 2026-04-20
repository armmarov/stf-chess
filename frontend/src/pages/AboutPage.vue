<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-1.5">
      <AppIcon name="info" class="h-5 w-5 text-indigo-600" />
      About
    </h1>

    <div class="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-2 items-center text-center">
      <img
        src="@/assets/logo-transparent.png"
        alt="STF Supreme Chess"
        class="h-16 w-auto"
      />
      <h2 class="text-xl font-semibold text-gray-900">STF Supreme Chess App</h2>
      <p class="text-sm text-gray-500">Version 1.0</p>
    </div>
  </div>
</template>
