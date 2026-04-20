<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-1.5">
      <AppIcon name="info" class="h-5 w-5 text-indigo-600" />
      About
    </h1>

    <div class="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-4">
      <div class="flex flex-col items-center gap-2 text-center">
        <img
          src="@/assets/logo-transparent.png"
          alt="STF Supreme Chess"
          class="h-16 w-auto"
        />
        <h2 class="text-xl font-semibold text-gray-900">STF Supreme Chess App</h2>
        <p class="text-sm text-gray-500">Version 1.0</p>
      </div>

      <hr class="border-gray-100" />

      <dl class="flex flex-col gap-3 text-sm">
        <div>
          <dt class="text-xs text-gray-500 uppercase tracking-wide">Developed by</dt>
          <dd class="text-gray-900 mt-0.5">Dr. Ammar Abdullah</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500 uppercase tracking-wide">GitHub</dt>
          <dd class="mt-0.5">
            <a
              href="https://github.com/armmarov"
              target="_blank"
              rel="noopener noreferrer"
              class="text-indigo-600 hover:underline break-all"
            >
              https://github.com/armmarov
            </a>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500 uppercase tracking-wide">LinkedIn</dt>
          <dd class="mt-0.5">
            <a
              href="https://www.linkedin.com/in/ammarabd"
              target="_blank"
              rel="noopener noreferrer"
              class="text-indigo-600 hover:underline break-all"
            >
              https://www.linkedin.com/in/ammarabd
            </a>
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
