<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chess } from 'chess.js'
import { useGameStore } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import type { GameResult } from '@/api/games'
import AppInput from '@/components/AppInput.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

const gameId = route.params.id as string | undefined
const isEdit = !!gameId
const game = computed(() => gameStore.current)

const tournamentName = ref('')
const whitePlayer = ref('')
const blackPlayer = ref('')
const result = ref<GameResult | ''>('')
const eventDate = ref('')
const whiteElo = ref('')
const blackElo = ref('')
const opening = ref('')
const notes = ref('')
const pgn = ref('')
const pgnError = ref('')

const submitting = ref(false)

const RESULT_OPTIONS: { value: GameResult; label: string }[] = [
  { value: 'white_win', label: 'White wins (1-0)' },
  { value: 'black_win', label: 'Black wins (0-1)' },
  { value: 'draw', label: 'Draw (½-½)' },
]

function validatePgn(): boolean {
  if (!pgn.value.trim()) {
    pgnError.value = ''
    return true
  }
  try {
    new Chess().loadPgn(pgn.value)
    pgnError.value = ''
    return true
  } catch (e) {
    pgnError.value = e instanceof Error ? e.message : 'Invalid PGN'
    return false
  }
}

onMounted(async () => {
  if (isEdit && gameId) {
    await gameStore.fetchGame(gameId)
    if (game.value) {
      tournamentName.value = game.value.tournamentName ?? ''
      whitePlayer.value = game.value.whitePlayer
      blackPlayer.value = game.value.blackPlayer
      result.value = game.value.result
      eventDate.value = game.value.eventDate ?? ''
      whiteElo.value = game.value.whiteElo != null ? String(game.value.whiteElo) : ''
      blackElo.value = game.value.blackElo != null ? String(game.value.blackElo) : ''
      opening.value = game.value.opening ?? ''
      notes.value = game.value.notes ?? ''
      pgn.value = game.value.pgn ?? ''
    }
  }
})

const canSubmit = computed(() => !!whitePlayer.value.trim() && !!blackPlayer.value.trim() && !!result.value)

async function handleSubmit() {
  if (!canSubmit.value || !result.value) return
  if (!validatePgn()) return
  submitting.value = true
  try {
    const body = {
      tournamentName: tournamentName.value.trim() || undefined,
      whitePlayer: whitePlayer.value.trim(),
      blackPlayer: blackPlayer.value.trim(),
      result: result.value,
      eventDate: eventDate.value || undefined,
      whiteElo: whiteElo.value ? parseInt(whiteElo.value, 10) : undefined,
      blackElo: blackElo.value ? parseInt(blackElo.value, 10) : undefined,
      opening: opening.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
      pgn: pgn.value.trim() || undefined,
    }
    if (isEdit && gameId) {
      await gameStore.update(gameId, body)
      toastStore.show('Game updated.', 'success')
      router.push(`/games/${gameId}`)
    } else {
      const created = await gameStore.create(body)
      toastStore.show('Game created.', 'success')
      router.push(`/games/${created.id}`)
    }
  } catch {
    toastStore.show('Failed to save game.', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/games')"
    >
      ← Back to games
    </button>

    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="chess" class="h-5 w-5 text-indigo-600" />
      {{ isEdit ? 'Edit Game' : 'New Game' }}
    </h1>

    <div v-if="gameStore.loading && isEdit && !game" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Players + result -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
        <AppInput v-model="whitePlayer" label="White player" placeholder="Player name" required />
        <AppInput v-model="blackPlayer" label="Black player" placeholder="Player name" required />

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">
            Result <span class="text-red-500">*</span>
          </label>
          <select
            v-model="result"
            required
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="" disabled>Select result…</option>
            <option v-for="opt in RESULT_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Event details -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
        <AppInput v-model="tournamentName" label="Tournament (optional)" placeholder="e.g. STF Open 2025" />
        <AppInput v-model="eventDate" label="Date (optional)" type="date" />
        <AppInput v-model="opening" label="Opening (optional)" placeholder="e.g. Sicilian Defense" />

        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="whiteElo" label="White Elo" type="number" placeholder="e.g. 1500" />
          <AppInput v-model="blackElo" label="Black Elo" type="number" placeholder="e.g. 1450" />
        </div>
      </div>

      <!-- PGN -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">PGN (optional)</label>
        <textarea
          v-model="pgn"
          rows="8"
          placeholder="Paste PGN here…"
          spellcheck="false"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs font-mono resize-y"
          :class="pgnError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''"
          @blur="validatePgn"
        />
        <p v-if="pgnError" class="text-xs text-red-600">{{ pgnError }}</p>
      </div>

      <!-- Notes -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Notes (optional)</label>
        <textarea
          v-model="notes"
          rows="3"
          placeholder="Annotations or commentary…"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none"
        />
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <AppButton class="flex-1" :disabled="submitting || !canSubmit" @click="handleSubmit">
          {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Game' }}
        </AppButton>
        <AppButton variant="secondary" class="flex-1" :disabled="submitting" @click="router.push('/games')">
          Cancel
        </AppButton>
      </div>
    </div>
  </div>
</template>
