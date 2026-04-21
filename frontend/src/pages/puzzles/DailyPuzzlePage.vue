<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chess } from 'chess.js'
import { usePuzzleStore } from '@/stores/puzzleStore'
import * as puzzleApi from '@/api/puzzles'
import type { PuzzleSummary } from '@/api/puzzles'
import ChessBoard from '@/components/ChessBoard.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

type PuzzleState = 'idle' | 'checking' | 'animating' | 'failed' | 'complete'

const puzzleStore = usePuzzleStore()
const puzzles = computed(() => puzzleStore.today?.puzzles ?? [])

// ── Session tracking (per page load) ──
// 'solved' | 'gave_up' for puzzles completed this session
const sessionResults = ref<Map<string, 'solved' | 'gave_up'>>(new Map())

const activeIndex = ref(0)
const activePuzzle = computed((): PuzzleSummary | null => puzzles.value[activeIndex.value] ?? null)

// ── Board state ──
const currentFen = ref('')
const boardLastMove = ref<[string, string] | undefined>(undefined)
const puzzleState = ref<PuzzleState>('idle')
const flashRed = ref(false)
const showSuccess = ref(false)

// Per-puzzle progress
const currentPly = ref(0)
const movesTaken = ref(0)
const wrongAttempts = ref(0)

// Timer
const timerStart = ref<number | null>(null)
const timerMs = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

const timerDisplay = computed(() => {
  const s = Math.floor(timerMs.value / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${(s % 60).toString().padStart(2, '0')}` : `${s}s`
})

// Board interactivity — always on, except during an in-flight API check or the
// opponent-reply animation. Once a puzzle is complete (solved or solution
// shown), the user can still drag pieces freely for exploration.
const isInteractive = computed(() =>
  puzzleState.value !== 'checking' && puzzleState.value !== 'animating',
)

const orientation = computed((): 'white' | 'black' => {
  const fen = activePuzzle.value?.fen
  if (!fen) return 'white'
  return fen.split(' ')[1] === 'w' ? 'white' : 'black'
})

// ── Completion helpers ──
function isDoneInSession(id: string): boolean {
  return sessionResults.value.has(id)
}

function isAlreadySolved(p: PuzzleSummary): boolean {
  return p.myAttempts.solved
}

function puzzleStatus(p: PuzzleSummary): 'solved' | 'gave_up' | 'tried' | 'untried' {
  const ses = sessionResults.value.get(p.id)
  if (ses) return ses
  if (p.myAttempts.solved) return 'solved'
  if (p.myAttempts.attempts > 0) return 'tried'
  return 'untried'
}

const allDone = computed(() =>
  puzzles.value.length > 0 &&
  puzzles.value.every(p => isDoneInSession(p.id) || isAlreadySolved(p)),
)

const sessionSolvedCount = computed(() => {
  let count = 0
  for (const p of puzzles.value) {
    if (sessionResults.value.get(p.id) === 'solved' || isAlreadySolved(p)) count++
  }
  return count
})

// ── Utilities ──
function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function applyUci(fen: string, uci: string): string {
  const chess = new Chess(fen)
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | undefined })
  return chess.fen()
}

function startTimer() {
  if (timerStart.value !== null) return
  timerStart.value = Date.now()
  timerInterval = setInterval(() => {
    timerMs.value = Date.now() - timerStart.value!
  }, 100)
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

// ── Load a specific puzzle ──
function loadPuzzle(p: PuzzleSummary) {
  stopTimer()
  timerStart.value = null
  timerMs.value = 0
  currentPly.value = 0
  movesTaken.value = 0
  wrongAttempts.value = 0
  currentFen.value = p.fen
  boardLastMove.value = undefined
  flashRed.value = false
  showSuccess.value = false
  // Only session-completion locks the board. Server-side "already solved" is
  // informational — user can replay the puzzle.
  puzzleState.value = isDoneInSession(p.id) ? 'complete' : 'idle'
}

function activateIndex(i: number) {
  if (i === activeIndex.value) return
  activeIndex.value = i
  const p = puzzles.value[i]
  if (p) loadPuzzle(p)
}

// ── Auto-advance to next unsolved puzzle ──
function advanceToNext() {
  for (let i = activeIndex.value + 1; i < puzzles.value.length; i++) {
    const p = puzzles.value[i]
    if (!isDoneInSession(p.id) && !isAlreadySolved(p)) {
      activateIndex(i)
      return
    }
  }
  // Check from beginning
  for (let i = 0; i < activeIndex.value; i++) {
    const p = puzzles.value[i]
    if (!isDoneInSession(p.id) && !isAlreadySolved(p)) {
      activateIndex(i)
      return
    }
  }
  // All done — stay on current puzzle
}

// ── Move handler ──
async function onMove(uci: string) {
  if (puzzleState.value !== 'idle' || !activePuzzle.value) return
  startTimer()

  puzzleState.value = 'checking'
  try {
    const res = await puzzleApi.checkMove(activePuzzle.value.id, {
      ply: currentPly.value,
      uci,
    })

    if (res.correct) {
      movesTaken.value++
      currentFen.value = applyUci(currentFen.value, uci)
      boardLastMove.value = [uci.slice(0, 2), uci.slice(2, 4)]

      if (res.solved) {
        stopTimer()
        await puzzleApi.postAttempt(activePuzzle.value.id, {
          status: 'solved',
          movesTaken: movesTaken.value,
          timeMs: timerMs.value,
        })
        sessionResults.value = new Map(sessionResults.value).set(activePuzzle.value.id, 'solved')
        showSuccess.value = true
        puzzleState.value = 'complete'
        await sleep(1400)
        showSuccess.value = false
      } else if (res.replyUci) {
        puzzleState.value = 'animating'
        await sleep(550)
        currentFen.value = applyUci(currentFen.value, res.replyUci)
        boardLastMove.value = [res.replyUci.slice(0, 2), res.replyUci.slice(2, 4)]
        currentPly.value += 2
        puzzleState.value = 'idle'
      }
    } else {
      wrongAttempts.value++
      flashRed.value = true
      puzzleState.value = 'failed'
      await sleep(700)
      currentFen.value = activePuzzle.value.fen
      boardLastMove.value = undefined
      flashRed.value = false
      puzzleState.value = 'idle'
    }
  } catch {
    puzzleState.value = 'idle'
  }
}

// ── Show solution (posts gave_up; BE returns solutionUci to animate) ──
async function showSolution() {
  if (!activePuzzle.value || puzzleState.value === 'checking' || puzzleState.value === 'animating') return
  stopTimer()

  let solutionUci: string[] = []
  try {
    const res = await puzzleApi.postAttempt(activePuzzle.value.id, {
      status: 'gave_up',
      movesTaken: movesTaken.value,
      timeMs: timerMs.value,
    })
    solutionUci = res.solutionUci ?? []
  } catch { /* non-critical */ }

  sessionResults.value = new Map(sessionResults.value).set(activePuzzle.value.id, 'gave_up')

  // Replay solution from the start position
  if (solutionUci.length) {
    puzzleState.value = 'animating'
    currentFen.value = activePuzzle.value.fen
    boardLastMove.value = undefined
    for (const uci of solutionUci) {
      await sleep(650)
      currentFen.value = applyUci(currentFen.value, uci)
      boardLastMove.value = [uci.slice(0, 2), uci.slice(2, 4)]
    }
  }

  puzzleState.value = 'complete'
}

// ── Init ──
watch(
  () => puzzleStore.today,
  (today) => {
    if (!today?.puzzles.length) return
    // Auto-start on first unsolved puzzle (server state)
    const firstUnsolved = today.puzzles.findIndex(p => !p.myAttempts.solved)
    activeIndex.value = firstUnsolved >= 0 ? firstUnsolved : 0
    loadPuzzle(today.puzzles[activeIndex.value])
  },
  { immediate: true },
)

onMounted(() => puzzleStore.fetchToday())
onBeforeUnmount(() => stopTimer())
</script>

<template>
  <div class="max-w-lg mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="puzzle" class="h-5 w-5 text-indigo-600" />
      Daily Puzzles
    </h1>

    <div v-if="puzzleStore.loading && !puzzleStore.today" class="text-center py-10 text-gray-400 text-sm">
      Loading puzzles…
    </div>

    <div v-else-if="puzzles.length" class="flex flex-col gap-4">

      <!-- Progress: 5 puzzle cards strip -->
      <div class="flex gap-2">
        <button
          v-for="(p, i) in puzzles"
          :key="p.id"
          class="flex-1 rounded-lg border p-2 text-center transition-all"
          :class="{
            'border-indigo-500 bg-indigo-50 shadow-sm': i === activeIndex,
            'border-green-300 bg-green-50': puzzleStatus(p) === 'solved' && i !== activeIndex,
            'border-gray-200 bg-gray-50 opacity-70': puzzleStatus(p) === 'gave_up' && i !== activeIndex,
            'border-gray-200 bg-white hover:border-indigo-200': puzzleStatus(p) === 'untried' && i !== activeIndex,
            'border-amber-200 bg-amber-50 hover:border-amber-300': puzzleStatus(p) === 'tried' && i !== activeIndex,
          }"
          @click="activateIndex(i)"
        >
          <div class="text-xs font-semibold text-gray-700">{{ i + 1 }}</div>
          <div class="text-xs text-gray-400">{{ p.rating }}</div>
          <div class="mt-0.5">
            <AppIcon
              v-if="puzzleStatus(p) === 'solved'"
              name="check-circle"
              class="h-3 w-3 text-green-500 mx-auto"
            />
            <AppIcon
              v-else-if="puzzleStatus(p) === 'gave_up'"
              name="x-mark"
              class="h-3 w-3 text-gray-400 mx-auto"
            />
            <span v-else class="block h-3 w-3 mx-auto" />
          </div>
        </button>
      </div>

      <!-- All done banner -->
      <div
        v-if="allDone"
        class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2"
      >
        <AppIcon name="check-circle" class="h-4 w-4 text-green-600 shrink-0" />
        <span>
          All done for today!
          <span class="font-medium">{{ sessionSolvedCount }} / {{ puzzles.length }} solved.</span>
        </span>
      </div>

      <!-- Active puzzle board -->
      <div v-if="activePuzzle" class="flex flex-col gap-3">
        <!-- Meta row -->
        <div class="flex items-center justify-between text-xs text-gray-500">
          <div class="flex items-center gap-3">
            <span class="font-medium text-gray-700">Puzzle {{ activeIndex + 1 }}</span>
            <span>Rating {{ activePuzzle.rating }}</span>
            <span v-if="activePuzzle.solutionLength">
              {{ Math.ceil(activePuzzle.solutionLength / 2) }}-move solution
            </span>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="wrongAttempts > 0" class="text-amber-600">
              {{ wrongAttempts }} mistake{{ wrongAttempts !== 1 ? 's' : '' }}
            </span>
            <span v-if="timerStart !== null && puzzleState !== 'complete'" class="font-mono">
              {{ timerDisplay }}
            </span>
          </div>
        </div>

        <!-- Board card -->
        <div
          class="bg-white rounded-lg border p-4 transition-colors duration-300"
          :class="flashRed
            ? 'border-red-400 bg-red-50'
            : showSuccess ? 'border-green-400 bg-green-50' : 'border-gray-200'"
        >
          <!-- Status hint -->
          <div class="flex items-center justify-between mb-2 text-xs">
            <div class="flex items-center gap-1.5">
              <span
                class="inline-block h-3 w-3 rounded-full border border-gray-300"
                :class="orientation === 'white' ? 'bg-white' : 'bg-gray-900'"
              />
              <span class="text-gray-600 capitalize">{{ orientation }} to move</span>
            </div>
            <span v-if="puzzleState === 'idle'" class="text-indigo-600 font-medium">Your turn</span>
            <span v-else-if="puzzleState === 'animating'" class="text-gray-500">Opponent replies…</span>
            <span v-else-if="puzzleState === 'failed'" class="text-red-600 font-medium">Not quite — retry</span>
            <span v-else-if="puzzleState === 'checking'" class="text-gray-400">Checking…</span>
            <span
              v-else-if="puzzleState === 'complete' && sessionResults.get(activePuzzle.id) === 'solved'"
              class="text-green-700 font-semibold flex items-center gap-1"
            >
              <AppIcon name="check-circle" class="h-3.5 w-3.5" />
              Solved!
            </span>
            <span
              v-else-if="puzzleState === 'complete' && isAlreadySolved(activePuzzle)"
              class="text-green-700 font-medium flex items-center gap-1"
            >
              <AppIcon name="check-circle" class="h-3.5 w-3.5" />
              Already solved
            </span>
          </div>

          <!-- Confetti-lite on solve -->
          <div v-if="showSuccess" class="relative pointer-events-none overflow-hidden h-0">
            <span
              v-for="i in 16"
              :key="i"
              class="absolute bottom-0 h-2 w-2 rounded-sm animate-confetti"
              :style="{
                left: `${(i - 1) * 6.25}%`,
                backgroundColor: ['#6366f1','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'][i % 8],
                animationDelay: `${i * 70}ms`,
              }"
            />
          </div>

          <ChessBoard
            v-if="currentFen && activePuzzle"
            :key="activePuzzle.id"
            :fen="currentFen"
            :orientation="orientation"
            :last-move="boardLastMove"
            :interactive="isInteractive"
            :move-side="orientation"
            @move="onMove"
          />
        </div>

        <!-- Themes -->
        <div v-if="activePuzzle.themes.length && puzzleState === 'complete'" class="flex flex-wrap gap-1.5">
          <span
            v-for="theme in activePuzzle.themes"
            :key="theme"
            class="inline-block rounded-full bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5"
          >
            {{ theme }}
          </span>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <AppButton
            v-if="puzzleState !== 'complete' && wrongAttempts >= 3"
            variant="secondary"
            class="flex-1"
            :disabled="puzzleState === 'checking' || puzzleState === 'animating'"
            @click="showSolution"
          >
            Show solution
          </AppButton>
          <AppButton
            v-else-if="puzzleState === 'complete' && !allDone"
            class="flex-1"
            @click="advanceToNext"
          >
            <AppIcon name="chevron-right" class="h-4 w-4" />
            Next puzzle
          </AppButton>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">No puzzles available today.</div>
  </div>
</template>

<style scoped>
@keyframes confetti-rise {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-160px) rotate(540deg); opacity: 0; }
}
.animate-confetti {
  animation: confetti-rise 1.1s ease-out forwards;
}
</style>
