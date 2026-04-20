<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { useToastStore } from '@/stores/toastStore'
import { getReceiptFullUrl } from '@/api/payments'
import type { PaymentStatus } from '@/stores/paymentStore'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const paymentStore = usePaymentStore()
const toastStore = useToastStore()

const id = route.params.id as string
const payment = computed(() => paymentStore.current)

const statusBadge: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

onMounted(async () => {
  try {
    await paymentStore.fetchPayment(id)
  } catch {
    toastStore.show('Failed to load payment.', 'error')
  }
})

function openReceipt() {
  if (!payment.value) return
  window.open(getReceiptFullUrl(payment.value.receiptUrl), '_blank')
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

    <div v-if="paymentStore.loading && !payment" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="payment" class="flex flex-col gap-4">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between mb-4 gap-3">
          <div>
            <h1 class="text-lg font-semibold text-gray-900">Payment Receipt</h1>
            <p class="text-sm text-gray-500 mt-0.5">
              {{ payment.session ? formatDate(payment.session.date) : 'No session linked' }}
            </p>
          </div>
          <span
            class="inline-block rounded-full text-xs px-2 py-0.5 font-medium capitalize shrink-0"
            :class="statusBadge[payment.status]"
          >
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
          <div v-if="payment.session">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="map-pin" class="h-3.5 w-3.5" />
              Session
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ payment.session.place }}</dd>
          </div>
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
              Reviewed
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ new Date(payment.reviewedAt).toLocaleString() }}</dd>
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

      <AppButton variant="secondary" class="w-full" @click="openReceipt">
        View Receipt
      </AppButton>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Payment not found.</div>
  </div>
</template>
