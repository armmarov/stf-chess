<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'

const props = defineProps<{
  fen: string
  orientation: 'white' | 'black'
  lastMove?: [string, string]
  arrow?: [string, string] | null
}>()

const el = ref<HTMLElement>()
let ground: Api | null = null

function toShapes(arrow: [string, string] | null | undefined) {
  if (!arrow) return []
  return [{ orig: arrow[0] as Key, dest: arrow[1] as Key, brush: 'green' }]
}

onMounted(() => {
  if (!el.value) return
  ground = Chessground(el.value, {
    fen: props.fen,
    orientation: props.orientation,
    viewOnly: true,
    coordinates: true,
    lastMove: props.lastMove as [Key, Key] | undefined,
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
  () => [props.fen, props.orientation, props.lastMove, props.arrow] as const,
  ([fen, orientation, lastMove, arrow]) => {
    ground?.set({
      fen,
      orientation,
      lastMove: lastMove as [Key, Key] | undefined,
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
