<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chess } from 'chess.js'
import { useGameStore } from '@/stores/gameStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { useStockfish } from '@/composables/useStockfish'
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
const stockfish = useStockfish()

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

// chess.js v1 can't handle multiple {...} comments per move (lichess export),
// strip comments + variations before parsing — main line only.
function sanitizePgn(pgn: string): string {
  return pgn
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^()]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function loadPgn(pgn: string) {
  try {
    const chess = new Chess()
    chess.loadPgn(sanitizePgn(pgn))
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

// ── Stockfish analysis ──
const analyzeMode = ref(false)

// Best-move arrow for ChessBoard
const arrow = computed((): [string, string] | null => {
  if (!analyzeMode.value || !stockfish.bestMove.value) return null
  const bm = stockfish.bestMove.value
  return [bm.slice(0, 2), bm.slice(2, 4)]
})

// Sigmoid: 0-100 from black's total win to white's
const evalPercent = computed(() => {
  if (stockfish.evalCp.value === null) return 50
  return Math.round(50 + (Math.atan(stockfish.evalCp.value / 300) / Math.PI) * 100)
})

const evalDisplay = computed(() => {
  if (!analyzeMode.value) return ''
  if (stockfish.evalCp.value === null) return '…'
  const cp = stockfish.evalCp.value
  if (cp >= 30000) return 'M+'
  if (cp <= -30000) return 'M-'
  const v = (Math.abs(cp) / 100).toFixed(1)
  return cp >= 0 ? `+${v}` : `-${v}`
})

// PV as SAN notation (first 5 moves), computed from current FEN
const pvSan = computed(() => {
  if (!analyzeMode.value || !stockfish.pvUci.value.length) return []
  try {
    const chess = new Chess(currentFen.value)
    const sans: string[] = []
    for (const uci of stockfish.pvUci.value.slice(0, 5)) {
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
      const move = chess.move({ from, to, promotion })
      if (!move) break
      sans.push(move.san)
    }
    return sans
  } catch {
    return []
  }
})

function toggleAnalysis() {
  analyzeMode.value = !analyzeMode.value
  if (analyzeMode.value) {
    stockfish.analyzePosition(currentFen.value)
  } else {
    stockfish.stop()
  }
}

// Re-analyze when position changes while analysis is active (300ms debounce)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(currentFen, (fen) => {
  if (!analyzeMode.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => stockfish.analyzePosition(fen), 300)
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

        <ChessBoard :fen="currentFen" :orientation="orientation" :last-move="lastMove" :arrow="arrow" />

        <!-- Nav + flip + analyze -->
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
          <!-- divider -->
          <div class="w-px h-6 bg-gray-200 ml-1" />
          <button
            class="p-2 rounded-lg border transition-colors"
            :class="analyzeMode
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
            title="Toggle Stockfish analysis"
            @click="toggleAnalysis"
          >
            <AppIcon name="cpu" class="h-4 w-4" />
          </button>
        </div>

        <!-- Eval bar + PV (visible when analyze mode is on) -->
        <div v-if="analyzeMode" class="border-t border-gray-100 pt-3 flex flex-col gap-1.5">
          <div v-if="stockfish.engineError.value" class="text-xs text-amber-600 text-center py-1">
            Analysis unavailable — page requires cross-origin isolation headers.
          </div>
          <template v-else>
            <!-- Eval number + status -->
            <div class="flex items-center gap-2">
              <span
                class="text-sm font-mono font-semibold w-14 shrink-0"
                :class="stockfish.evalCp.value !== null && stockfish.evalCp.value < 0 ? 'text-indigo-700' : 'text-gray-900'"
              >
                {{ evalDisplay }}
              </span>
              <span v-if="stockfish.analyzing.value" class="text-xs text-gray-400">
                analyzing…
              </span>
              <span v-else-if="stockfish.searchDepth.value > 0" class="text-xs text-gray-400">
                depth {{ stockfish.searchDepth.value }}
              </span>
            </div>

            <!-- Horizontal eval bar: black left (dark), white right (light) -->
            <div class="h-2 rounded-full overflow-hidden flex bg-gray-100">
              <div
                class="bg-gray-900 transition-all duration-500 ease-out"
                :style="{ width: `${100 - evalPercent}%` }"
              />
            </div>

            <!-- PV line -->
            <p v-if="pvSan.length" class="text-xs text-gray-600 font-mono truncate">
              {{ pvSan.join(' ') }}
            </p>
          </template>
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
