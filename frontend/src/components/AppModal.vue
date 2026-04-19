<script setup lang="ts">
defineProps<{ title: string; open: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" @click="$emit('close')" />
        <div class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-5 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-gray-900 text-base">{{ title }}</h2>
            <button
              class="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close"
              @click="$emit('close')"
            >
              &times;
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
</style>
