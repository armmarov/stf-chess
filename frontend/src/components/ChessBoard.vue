<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chess } from 'chess.js'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'

const props = defineProps<{
  fen: string
  orientation: 'white' | 'black'
  lastMove?: [string, string]
  arrow?: [string, string] | null
  /** When true, enables piece movement for moveSide. Default: false (view-only). */
  interactive?: boolean
  /** Which side may move when interactive is true. */
  moveSide?: 'white' | 'black'
}>()

const emit = defineEmits<{
  move: [uci: string]
}>()

const el = ref<HTMLElement>()
let ground: Api | null = null

// Keep a ref so the move handler always reads the current FEN (for promotion detection)
const activeFen = ref(props.fen)

function toShapes(arrow: [string, string] | null | undefined) {
  if (!arrow) return []
  return [{ orig: arrow[0] as Key, dest: arrow[1] as Key, brush: 'green' }]
}

// Auto-promote to queen (standard for puzzles; underpromotion extremely rare)
function uciFrom(orig: Key, dest: Key): string {
  const chess = new Chess(activeFen.value)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const piece = chess.get(orig as any)
  const toRank = dest[1]
  const isPromo = piece?.type === 'p' && (toRank === '8' || toRank === '1')
  return isPromo ? `${orig}${dest}q` : `${orig}${dest}`
}

onMounted(() => {
  if (!el.value) return
  ground = Chessground(el.value, {
    fen: props.fen,
    orientation: props.orientation,
    viewOnly: !props.interactive,
    coordinates: true,
    lastMove: props.lastMove as [Key, Key] | undefined,
    movable: {
      // 'both' + free=true lets the user try any drag; the parent decides what
      // counts as correct via the move handler.
      color: props.interactive ? 'both' : undefined,
      free: true,
      dests: new Map(),
      events: {
        after: (orig, dest) => emit('move', uciFrom(orig, dest)),
      },
    },
    premovable: { enabled: false },
    drawable: {
      enabled: false,
      visible: true,
      shapes: toShapes(props.arrow),
    },
  })
})

onBeforeUnmount(() => {
  ground?.stop()
  ground = null
})

watch(
  () => [props.fen, props.orientation, props.lastMove, props.arrow, props.interactive, props.moveSide] as const,
  ([fen, orientation, lastMove, arrow, interactive]) => {
    activeFen.value = fen
    ground?.set({
      fen,
      orientation,
      viewOnly: !interactive,
      lastMove: lastMove as [Key, Key] | undefined,
      movable: {
        color: interactive ? 'both' : undefined,
        free: true,
        dests: new Map(),
      },
      drawable: {
        shapes: toShapes(arrow),
      },
    })
  },
)
</script>

<template>
  <!-- chessground requires a block element; aspect-square keeps the board square -->
  <div class="w-full max-w-md mx-auto aspect-square">
    <div ref="el" class="w-full h-full" />
  </div>
</template>
