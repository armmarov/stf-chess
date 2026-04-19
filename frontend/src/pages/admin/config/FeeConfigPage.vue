<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConfigStore } from '@/stores/configStore'
import { useToastStore } from '@/stores/toastStore'
import AppButton from '@/components/AppButton.vue'
import AppModal from '@/components/AppModal.vue'

const configStore = useConfigStore()
const toastStore = useToastStore()

const feeInput = ref('')
const confirmModalOpen = ref(false)
const saving = ref(false)
const inputError = ref('')

onMounted(async () => {
  await configStore.fetchFee()
  if (configStore.fee !== null) {
    feeInput.value = configStore.fee.toFixed(2)
  }
})

function openConfirm() {
  const parsed = parseFloat(feeInput.value)
  if (isNaN(parsed) || parsed < 0) {
    inputError.value = 'Please enter a valid fee amount.'
    return
  }
  inputError.value = ''
  confirmModalOpen.value = true
}

async function confirmSave() {
  saving.value = true
  try {
    await configStore.updateFee(parseFloat(feeInput.value))
    toastStore.show('Fee updated.', 'success')
    confirmModalOpen.value = false
  } catch {
    toastStore.show('Failed to update fee. Please try again.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-1">Fee Configuration</h1>
    <p class="text-sm text-gray-500 mb-6">Set the global session fee for new payments.</p>

    <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
      <div v-if="configStore.loading" class="text-center py-4 text-gray-400 text-sm">
        Loading…
      </div>

      <template v-else>
        <div v-if="configStore.fee !== null" class="text-sm text-gray-600">
          Current fee: <span class="font-semibold text-gray-900">RM {{ configStore.fee.toFixed(2) }}</span>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">New Fee (RM)</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">RM</span>
            <input
              v-model="feeInput"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 pl-10"
            />
          </div>
          <p v-if="inputError" role="alert" class="text-xs text-red-600">{{ inputError }}</p>
        </div>

        <AppButton class="w-full" @click="openConfirm">Save Fee</AppButton>
      </template>
    </div>

    <!-- Confirmation modal -->
    <AppModal title="Update Session Fee?" :open="confirmModalOpen" @close="confirmModalOpen = false">
      <div class="flex flex-col gap-3 text-sm text-gray-700">
        <p>
          The session fee will be set to
          <span class="font-semibold">RM {{ parseFloat(feeInput || '0').toFixed(2) }}</span>.
        </p>
        <p class="text-xs text-gray-500">
          Historical payments will <strong>not</strong> be re-priced. This fee applies only to new
          payment uploads from this point forward.
        </p>
        <div class="flex gap-2">
          <AppButton class="flex-1" :disabled="saving" @click="confirmSave">
            {{ saving ? 'Saving…' : 'Confirm' }}
          </AppButton>
          <AppButton variant="secondary" class="flex-1" @click="confirmModalOpen = false">
            Cancel
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
