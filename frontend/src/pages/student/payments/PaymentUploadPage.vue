<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { usePaymentStore } from '@/stores/paymentStore'
import { useConfigStore } from '@/stores/configStore'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const paymentStore = usePaymentStore()
const configStore = useConfigStore()
const toastStore = useToastStore()

const selectedSessionId = ref('')
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const submitting = ref(false)
const error = ref('')

// Fetch sessions from last 30 days + upcoming
const today = new Date()
const from = new Date(today)
from.setDate(from.getDate() - 30)

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

const availableSessions = computed(() =>
  sessionStore.sessions.filter((s) => !s.isCancelled),
)

onMounted(async () => {
  await Promise.all([
    sessionStore.fetchSessions({ from: toISO(from), includeCancelled: false }),
    configStore.fetchFee(),
  ])
})

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0] ?? null
  file.value = picked

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }

  if (picked && picked.type.startsWith('image/')) {
    previewUrl.value = URL.createObjectURL(picked)
  }
}

function validate(): string {
  if (!selectedSessionId.value) return 'Please select a session.'
  if (!file.value) return 'Please choose a receipt file.'
  const allowed = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowed.includes(file.value.type)) return 'Only JPG, PNG, or PDF files are accepted.'
  if (file.value.size > 5 * 1024 * 1024) return 'File must be 5 MB or less.'
  return ''
}

async function submit() {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    await paymentStore.uploadPayment(selectedSessionId.value, file.value!)
    toastStore.show('Receipt uploaded successfully.', 'success')
    router.push('/student/payments')
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    error.value = msg ?? 'Upload failed. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/student/payments')"
    >
      ← Back to payments
    </button>

    <h1 class="text-lg font-semibold text-gray-900 mb-4">Upload Payment Receipt</h1>

    <!-- Fee display -->
    <div v-if="configStore.fee !== null" class="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 text-sm text-indigo-800">
      Session fee: <span class="font-semibold">RM {{ configStore.fee.toFixed(2) }}</span>
    </div>

    <form class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4" @submit.prevent="submit">
      <!-- Session select -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">
          Session <span class="text-red-500">*</span>
        </label>
        <div v-if="sessionStore.loading" class="text-xs text-gray-400">Loading sessions…</div>
        <select
          v-else
          v-model="selectedSessionId"
          class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        >
          <option value="">Select a session…</option>
          <option v-for="s in availableSessions" :key="s.id" :value="s.id">
            {{ formatDate(s.date) }} — {{ s.place }}
          </option>
        </select>
        <p v-if="availableSessions.length === 0 && !sessionStore.loading" class="text-xs text-gray-400">
          No sessions available in the last 30 days.
        </p>
      </div>

      <!-- File picker -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">
          Receipt (JPG / PNG / PDF, max 5 MB) <span class="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          class="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          @change="onFileChange"
        />
      </div>

      <!-- Image preview -->
      <div v-if="previewUrl" class="rounded-lg overflow-hidden border border-gray-200">
        <img :src="previewUrl" alt="Receipt preview" class="w-full max-h-64 object-contain bg-gray-50" />
      </div>
      <div v-else-if="file && file.type === 'application/pdf'" class="text-xs text-gray-500 italic">
        PDF selected — preview not available.
      </div>

      <!-- Error -->
      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>

      <AppButton type="submit" :disabled="submitting" class="w-full">
        {{ submitting ? 'Uploading…' : 'Submit Receipt' }}
      </AppButton>
    </form>
  </div>
</template>
