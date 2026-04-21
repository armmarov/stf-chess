<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePuzzleStore } from '@/stores/puzzleStore'
import AppIcon from '@/components/AppIcon.vue'

const puzzleStore = usePuzzleStore()
const progress = computed(() => puzzleStore.todayProgress)
const allDone = computed(() => progress.value.solved >= progress.value.total)

onMounted(() => puzzleStore.fetchToday())
</script>

<template>
  <RouterLink
    to="/puzzle"
    class="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:border-indigo-300"
    :class="allDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'"
  >
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        :class="allDone ? 'bg-green-100' : 'bg-indigo-50'"
      >
        <AppIcon
          :name="allDone ? 'check-circle' : 'puzzle'"
          class="h-5 w-5"
          :class="allDone ? 'text-green-600' : 'text-indigo-600'"
        />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-900">Daily Puzzles</p>
        <template v-if="!puzzleStore.loading && puzzleStore.today">
          <p class="text-xs text-gray-500 mt-0.5">
            {{ progress.solved }} / {{ progress.total }} solved today
          </p>
          <!-- Progress bar -->
          <div class="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="allDone ? 'bg-green-500' : 'bg-indigo-500'"
              :style="{ width: `${(progress.solved / progress.total) * 100}%` }"
            />
          </div>
        </template>
        <p v-else-if="puzzleStore.loading" class="text-xs text-gray-400 mt-0.5">Loading…</p>
      </div>
    </div>
    <span class="text-xs font-medium shrink-0" :class="allDone ? 'text-green-600' : 'text-indigo-600'">
      {{ allDone ? 'Play again' : 'Try it' }} →
    </span>
  </RouterLink>
</template>
