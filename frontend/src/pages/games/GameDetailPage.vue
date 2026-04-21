<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chess } from 'chess.js'
import { useGameStore } from '@/stores/gameStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { RESULT_DISPLAY, RESULT_COLORS } from '@/api/games'
import { formatDate } from '@/utils/format'
import ChessBoard from '@/components/ChessBoard.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const auth = useAuthStore()
const toastStore = useToastStore()
const { confirm } = useConfirm()

const id = route.params.id as string
const game = computed(() => gameStore.current)
const isAdmin = computed(() => auth.user?.role === 'admin')

// ── Chess replay state ──
interface VerboseMove {
  san: string
  from: string
  to: string
}

const fenArray = ref<string[]>([STARTING_FEN])
const verboseMoves = ref<VerboseMove[]>([])
const currentPly = ref(0)
const orientation = ref<'white' | 'black'>('white')

const currentFen = computed(() => fenArray.value[currentPly.value] ?? STARTING_FEN)

const lastMove = computed((): [string, string] | undefined => {
  if (currentPly.value === 0) return undefined
  const m = verboseMoves.value[currentPly.value - 1]
  return m ? [m.from, m.to] : undefined
})

const sideToMove = computed(() => {
  const parts = currentFen.value.split(' ')
  return parts[1] === 'w' ? 'white' : 'black'
})

const totalPlies = computed(() => verboseMoves.value.length)

function loadPgn(pgn: string) {
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    const moves = chess.history({ verbose: true }) as VerboseMove[]
    const fens: string[] = [new Chess().fen()]
    const replay = new Chess()
    for (const m of moves) {
      replay.move(m.san)
      fens.push(replay.fen())
    }
    fenArray.value = fens
    verboseMoves.value = moves
  } catch {
    // Malformed PGN — just show starting position
    fenArray.value = [STARTING_FEN]
    verboseMoves.value = []
  }
}

watch(
  () => game.value?.pgn,
  (pgn) => {
    currentPly.value = 0
    if (pgn) loadPgn(pgn)
    else {
      fenArray.value = [STARTING_FEN]
      verboseMoves.value = []
    }
  },
  { immediate: true },
)

// ── Navigation ──
function goFirst() { currentPly.value = 0 }
function goPrev() { if (currentPly.value > 0) currentPly.value-- }
function goNext() { if (currentPly.value < totalPlies.value) currentPly.value++ }
function goLast() { currentPly.value = totalPlies.value }
function goToPly(ply: number) { currentPly.value = ply }

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
  if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

// ── Move list ──
interface MovePair {
  num: number
  whiteSan: string
  whitePly: number
  blackSan?: string
  blackPly?: number
}

const movePairs = computed((): MovePair[] => {
  const pairs: MovePair[] = []
  for (let i = 0; i < verboseMoves.value.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      whiteSan: verboseMoves.value[i].san,
      whitePly: i + 1,
      blackSan: verboseMoves.value[i + 1]?.san,
      blackPly: verboseMoves.value[i + 1] ? i + 2 : undefined,
    })
  }
  return pairs
})

const moveListEl = ref<HTMLElement | null>(null)

watch(currentPly, () => {
  nextTick(() => {
    const el = moveListEl.value?.querySelector<HTMLElement>('[data-current="true"]')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
})

// ── Admin actions ──
async function handleDelete() {
  const ok = await confirm({
    title: 'Delete game?',
    message: 'This will permanently remove the game and its PGN.',
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await gameStore.remove(id)
    toastStore.show('Game deleted.', 'success')
    router.push('/games')
  } catch {
    toastStore.show('Failed to delete game.', 'error')
  }
}

onMounted(() => gameStore.fetchGame(id))
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/games')"
    >
      ← Back to games
    </button>

    <div v-if="gameStore.loading && !game" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="game" class="flex flex-col gap-4">
      <!-- Header card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="flex-1 min-w-0">
            <p v-if="game.tournamentName" class="text-xs text-indigo-600 font-medium mb-0.5">
              {{ game.tournamentName }}
            </p>
            <h1 class="text-base font-semibold text-gray-900">
              {{ game.whitePlayer }} vs {{ game.blackPlayer }}
            </h1>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span
                class="inline-block rounded text-xs px-2 py-0.5 font-mono font-medium"
                :class="RESULT_COLORS[game.result]"
              >
                {{ RESULT_DISPLAY[game.result] }}
              </span>
              <span v-if="game.eventDate" class="text-xs text-gray-400">
                {{ formatDate(game.eventDate) }}
              </span>
              <span v-if="game.opening" class="text-xs text-gray-500 truncate">{{ game.opening }}</span>
            </div>
          </div>
          <div v-if="isAdmin" class="flex gap-1.5 shrink-0">
            <AppButton variant="secondary" @click="router.push(`/admin/games/${id}/edit`)">
              <AppIcon name="edit" class="h-4 w-4" />
            </AppButton>
            <AppButton variant="danger" @click="handleDelete">
              <AppIcon name="trash" class="h-4 w-4" />
            </AppButton>
          </div>
        </div>
        <div v-if="game.whiteElo || game.blackElo" class="text-xs text-gray-400">
          <span v-if="game.whiteElo">White: {{ game.whiteElo }}</span>
          <span v-if="game.whiteElo && game.blackElo"> · </span>
          <span v-if="game.blackElo">Black: {{ game.blackElo }}</span>
        </div>
      </div>

      <!-- Board + controls -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
        <!-- Side to move indicator -->
        <div class="flex items-center justify-between text-xs text-gray-500">
          <div class="flex items-center gap-1.5">
            <span
              class="inline-block h-3 w-3 rounded-full border border-gray-300"
              :class="sideToMove === 'white' ? 'bg-white' : 'bg-gray-900'"
            />
            {{ sideToMove === 'white' ? 'White' : 'Black' }} to move
          </div>
          <span class="text-gray-400">
            {{ currentPly === 0 ? 'Start' : `Move ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? '.' : '…'}` }}
          </span>
        </div>

        <ChessBoard :fen="currentFen" :orientation="orientation" :last-move="lastMove" />

        <!-- Nav + flip -->
        <div class="flex items-center justify-center gap-2">
          <button
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors text-gray-700"
            :disabled="currentPly === 0"
            title="First"
            @click="goFirst"
          >
            <AppIcon name="chevron-double-left" class="h-4 w-4" />
          </button>
          <button
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors text-gray-700"
            :disabled="currentPly === 0"
            title="Previous (←)"
            @click="goPrev"
          >
            <AppIcon name="chevron-left" class="h-4 w-4" />
          </button>
          <button
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors text-gray-700"
            :disabled="currentPly === totalPlies"
            title="Next (→)"
            @click="goNext"
          >
            <AppIcon name="chevron-right" class="h-4 w-4" />
          </button>
          <button
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors text-gray-700"
            :disabled="currentPly === totalPlies"
            title="Last"
            @click="goLast"
          >
            <AppIcon name="chevron-double-right" class="h-4 w-4" />
          </button>
          <button
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700 ml-2"
            title="Flip board"
            @click="orientation = orientation === 'white' ? 'black' : 'white'"
          >
            <AppIcon name="arrows-up-down" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Move list -->
      <div v-if="verboseMoves.length > 0" class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-sm font-semibold text-gray-900 mb-3">Moves</p>
        <div
          ref="moveListEl"
          class="max-h-52 overflow-y-auto font-mono text-sm"
        >
          <div
            v-for="pair in movePairs"
            :key="pair.num"
            class="flex items-center gap-1 py-0.5"
          >
            <span class="text-gray-400 w-7 shrink-0 text-right">{{ pair.num }}.</span>
            <button
              class="px-1.5 py-0.5 rounded min-w-[3.5rem] text-left transition-colors"
              :class="currentPly === pair.whitePly
                ? 'bg-indigo-600 text-white font-semibold'
                : 'hover:bg-gray-100 text-gray-800'"
              :data-current="currentPly === pair.whitePly"
              @click="goToPly(pair.whitePly)"
            >
              {{ pair.whiteSan }}
            </button>
            <button
              v-if="pair.blackSan"
              class="px-1.5 py-0.5 rounded min-w-[3.5rem] text-left transition-colors"
              :class="currentPly === pair.blackPly
                ? 'bg-indigo-600 text-white font-semibold'
                : 'hover:bg-gray-100 text-gray-800'"
              :data-current="currentPly === pair.blackPly"
              @click="goToPly(pair.blackPly!)"
            >
              {{ pair.blackSan }}
            </button>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="game.notes" class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-sm font-semibold text-gray-900 mb-1">Notes</p>
        <p class="text-sm text-gray-600 whitespace-pre-wrap">{{ game.notes }}</p>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Game not found.</div>
  </div>
</template>
