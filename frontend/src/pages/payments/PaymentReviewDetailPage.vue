<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { getReceiptFullUrl } from '@/api/payments'
import type { PaymentStatus } from '@/stores/paymentStore'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatDate, toHHMM, sessionSerial } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const paymentStore = usePaymentStore()
const toastStore = useToastStore()

const id = route.params.id as string
const payment = computed(() => paymentStore.current)

const reviewing = ref(false)
const note = ref('')
const reviewError = ref('')
const { confirm } = useConfirm()

const statusBadge: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

onMounted(() => paymentStore.fetchPayment(id))

// Guess MIME type from receiptUrl filename extension for inline preview decision
const isImageReceipt = computed(() => {
  if (!payment.value) return false
  const url = payment.value.receiptUrl.toLowerCase()
  return url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png')
})

const isPdfReceipt = computed(() => {
  if (!payment.value) return false
  return payment.value.receiptUrl.toLowerCase().endsWith('.pdf')
})

const receiptFullUrl = computed(() =>
  payment.value ? getReceiptFullUrl(payment.value.receiptUrl) : '',
)

async function review(decision: 'approve' | 'reject') {
  if (decision === 'reject') {
    const ok = await confirm({
      title: 'Reject payment?',
      message: 'The student will be notified and can re-upload.',
      confirmLabel: 'Reject',
      variant: 'danger',
    })
    if (!ok) return
  }
  reviewing.value = true
  reviewError.value = ''
  try {
    await paymentStore.reviewPayment(id, decision, note.value.trim() || undefined)
    toastStore.show(decision === 'approve' ? 'Payment approved.' : 'Payment rejected.', 'success')
    router.push('/payments/review')
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      reviewError.value = 'This payment has already been processed.'
      await paymentStore.fetchPayment(id)
    } else {
      reviewError.value = 'Failed to submit review. Please try again.'
    }
  } finally {
    reviewing.value = false
  }
}

function openInNewTab() {
  window.open(receiptFullUrl.value, '_blank')
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/payments/review')"
    >
      ← Back to payment review
    </button>

    <div v-if="paymentStore.loading && !payment" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="payment" class="flex flex-col gap-4">
      <!-- Detail card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between mb-4 gap-3">
          <div>
            <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
              <AppIcon name="user" class="h-4 w-4 text-indigo-500 shrink-0" />
              {{ payment.student.name }}
            </h1>
            <p class="text-sm text-gray-500 mt-0.5">@{{ payment.student.username }}</p>
          </div>
          <span
            class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium capitalize shrink-0"
            :class="statusBadge[payment.status]"
          >
            <AppIcon name="tag" class="h-3 w-3" />
            {{ payment.status }}
          </span>
        </div>

        <dl class="flex flex-col gap-3 text-sm border-t border-gray-100 pt-4">
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="dollar" class="h-3.5 w-3.5" />
              Amount
            </dt>
            <dd class="text-gray-900 mt-0.5">RM {{ parseFloat(payment.amount).toFixed(2) }}</dd>
          </div>
          <template v-if="payment.session">
            <div>
              <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                <AppIcon name="calendar" class="h-3.5 w-3.5" />
                Date
              </dt>
              <dd class="text-gray-900 mt-0.5">
                <RouterLink
                  :to="`/sessions/${payment.session.id}`"
                  class="text-indigo-600 hover:underline"
                >
                  {{ formatDate(payment.session.date) }}
                </RouterLink>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                <AppIcon name="map-pin" class="h-3.5 w-3.5" />
                Venue
              </dt>
              <dd class="text-gray-900 mt-0.5">{{ payment.session.place }}</dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                <AppIcon name="clock" class="h-3.5 w-3.5" />
                Time
              </dt>
              <dd class="text-gray-900 mt-0.5">{{ toHHMM(payment.session.startTime) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                <AppIcon name="hash" class="h-3.5 w-3.5" />
                Session ID
              </dt>
              <dd class="mt-0.5"><code class="text-xs text-gray-700 font-mono select-all">{{ sessionSerial(payment.session.id, payment.session.date) }}</code></dd>
            </div>
          </template>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="clock" class="h-3.5 w-3.5" />
              Uploaded
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ new Date(payment.uploadedAt).toLocaleString() }}</dd>
          </div>
          <div v-if="payment.reviewedAt">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="user-circle" class="h-3.5 w-3.5" />
              Reviewed by
            </dt>
            <dd class="text-gray-900 mt-0.5">
              {{ payment.reviewedBy?.name }} · {{ new Date(payment.reviewedAt).toLocaleString() }}
            </dd>
          </div>
          <div v-if="payment.note">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="document" class="h-3.5 w-3.5" />
              Note
            </dt>
            <dd class="text-gray-900 mt-0.5 whitespace-pre-line">{{ payment.note }}</dd>
          </div>
        </dl>
      </div>

      <!-- Receipt preview -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Receipt</p>
          <button class="text-xs text-indigo-600 hover:underline" @click="openInNewTab">
            Open in new tab
          </button>
        </div>

        <!-- Inline image preview -->
        <img
          v-if="isImageReceipt"
          :src="receiptFullUrl"
          alt="Payment receipt"
          class="w-full max-h-96 object-contain rounded bg-gray-50"
        />

        <!-- PDF iframe -->
        <iframe
          v-else-if="isPdfReceipt"
          :src="receiptFullUrl"
          class="w-full h-64 rounded border border-gray-100"
          title="Receipt PDF"
        />

        <!-- Unknown type — link only -->
        <p v-else class="text-sm text-gray-500">
          <a :href="receiptFullUrl" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline">
            Download receipt
          </a>
        </p>
      </div>

      <!-- Review actions (pending only) -->
      <div v-if="payment.status === 'pending'" class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
        <p class="text-sm font-medium text-gray-900">Review Decision</p>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-700">Note (optional)</label>
          <textarea
            v-model="note"
            rows="2"
            placeholder="Add a note for the student…"
            class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 resize-none"
          />
        </div>

        <p v-if="reviewError" role="alert" class="text-xs text-red-600">{{ reviewError }}</p>

        <div class="flex gap-3">
          <AppButton class="flex-1" :disabled="reviewing" @click="review('approve')">
            {{ reviewing ? '…' : 'Approve' }}
          </AppButton>
          <AppButton variant="danger" class="flex-1" :disabled="reviewing" @click="review('reject')">
            {{ reviewing ? '…' : 'Reject' }}
          </AppButton>
        </div>
      </div>

      <!-- Already-reviewed notice -->
      <p v-else-if="reviewError" role="alert" class="text-xs text-red-600 px-1">{{ reviewError }}</p>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Payment not found.</div>
  </div>
</template>
