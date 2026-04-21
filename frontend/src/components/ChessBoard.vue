<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'

const props = defineProps<{
  fen: string
  orientation: 'white' | 'black'
  lastMove?: [string, string]
}>()

const el = ref<HTMLElement>()
let ground: Api | null = null

onMounted(() => {
  if (!el.value) return
  ground = Chessground(el.value, {
    fen: props.fen,
    orientation: props.orientation,
    viewOnly: true,
    coordinates: true,
    lastMove: props.lastMove as [Key, Key] | undefined,
  })
})

onBeforeUnmount(() => {
  ground?.stop()
  ground = null
})

watch(
  () => [props.fen, props.orientation, props.lastMove] as const,
  ([fen, orientation, lastMove]) => {
    ground?.set({
      fen,
      orientation,
      lastMove: lastMove as [Key, Key] | undefined,
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
