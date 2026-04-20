<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'
import AppButton from '@/components/AppButton.vue'

const { state, respond } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="state.open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" @click="respond(false)" />
        <div
          role="alertdialog"
          :aria-labelledby="'confirm-title'"
          class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-5 flex flex-col gap-4"
        >
          <h2 id="confirm-title" class="font-semibold text-gray-900 text-base">
            {{ state.opts.title }}
          </h2>
          <p class="text-sm text-gray-600">{{ state.opts.message }}</p>
          <div class="flex gap-2 justify-end">
            <AppButton variant="secondary" @click="respond(false)">Cancel</AppButton>
            <AppButton :variant="state.opts.variant ?? 'danger'" @click="respond(true)">
              {{ state.opts.confirmLabel ?? 'Confirm' }}
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.15s ease;
}
</style>
