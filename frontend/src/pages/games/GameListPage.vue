<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useAuthStore } from '@/stores/authStore'
import { RESULT_DISPLAY, RESULT_COLORS } from '@/api/games'
import { formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const gameStore = useGameStore()
const auth = useAuthStore()

const isAdmin = computed(() => auth.user?.role === 'admin')

const search = ref('')

const displayList = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return gameStore.list
  return gameStore.list.filter(
    (g) =>
      g.tournamentName?.toLowerCase().includes(q) ||
      g.whitePlayer.toLowerCase().includes(q) ||
      g.blackPlayer.toLowerCase().includes(q),
  )
})

function handleSearch() {
  const q = search.value.trim()
  gameStore.fetchList(
    q ? { player: q } : undefined,
  )
}

onMounted(() => gameStore.fetchList())
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="chess" class="h-5 w-5 text-indigo-600" />
        Games
      </h1>
      <AppButton v-if="isAdmin" @click="router.push('/admin/games/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New Game
      </AppButton>
    </div>

    <!-- Search -->
    <div class="relative mb-4">
      <AppIcon name="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        v-model="search"
        type="search"
        placeholder="Search tournament or player…"
        class="w-full rounded-lg border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        @keyup.enter="handleSearch"
      />
    </div>

    <div v-if="gameStore.loading && gameStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="displayList.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No games found.
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="game in displayList"
        :key="game.id"
        class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors"
        @click="router.push(`/games/${game.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p v-if="game.tournamentName" class="text-xs text-indigo-600 font-medium mb-0.5 truncate">
              {{ game.tournamentName }}
            </p>
            <p class="font-medium text-gray-900 text-sm">
              {{ game.whitePlayer }} vs {{ game.blackPlayer }}
            </p>
            <p v-if="game.opening" class="text-xs text-gray-500 mt-0.5 truncate">{{ game.opening }}</p>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span
              class="inline-block rounded text-xs px-2 py-0.5 font-mono font-medium"
              :class="RESULT_COLORS[game.result]"
            >
              {{ RESULT_DISPLAY[game.result] }}
            </span>
            <span v-if="game.eventDate" class="text-xs text-gray-400">
              {{ formatDate(game.eventDate) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
