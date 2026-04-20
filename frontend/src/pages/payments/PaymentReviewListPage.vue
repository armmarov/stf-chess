<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import type { PaymentStatus } from '@/stores/paymentStore'
import { getReceiptFullUrl } from '@/api/payments'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatDate } from '@/utils/format'

const router = useRouter()
const paymentStore = usePaymentStore()
const toastStore = useToastStore()

type StatusFilter = PaymentStatus | 'all'
const statusFilter = ref<StatusFilter>('pending')

const tabs: { label: string; value: StatusFilter }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
]

const query = computed(() => ({
  status: statusFilter.value === 'all' ? undefined : statusFilter.value,
}))

const cacheKey = computed(() => paymentStore.cacheKey(query.value))
const payments = computed(() => paymentStore.listCache[cacheKey.value] ?? [])

const reviewingId = ref<string | null>(null)
const { confirm } = useConfirm()

const statusBadge: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

async function load() {
  try {
    await paymentStore.fetchPayments(query.value)
  } catch {
    toastStore.show('Failed to load payments.', 'error')
  }
}

watch(statusFilter, load)
onMounted(load)

async function quickReview(id: string, decision: 'approve' | 'reject') {
  if (decision === 'reject') {
    const ok = await confirm({
      title: 'Reject payment?',
      message: 'The student will be notified and can re-upload.',
      confirmLabel: 'Reject',
      variant: 'danger',
    })
    if (!ok) return
  }
  reviewingId.value = id
  try {
    await paymentStore.reviewPayment(id, decision)
    toastStore.show(decision === 'approve' ? 'Payment approved.' : 'Payment rejected.', 'success')
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      toastStore.show('This payment has already been processed.', 'error')
      await load()
    } else {
      toastStore.show('Failed to update payment status.', 'error')
    }
  } finally {
    reviewingId.value = null
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-1.5">
      <AppIcon name="dollar" class="h-5 w-5 text-indigo-600" />
      Payment Review
    </h1>

    <!-- Status tabs -->
    <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="
          statusFilter === tab.value
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        "
        @click="statusFilter = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="paymentStore.loading" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <!-- Empty -->
    <div v-else-if="payments.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No payments found.
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="payment in payments"
        :key="payment.id"
        class="bg-white rounded-lg border border-gray-200 p-4"
      >
        <!-- Row header -->
        <div
          class="flex items-start justify-between gap-2 mb-3 cursor-pointer"
          @click="router.push(`/payments/review/${payment.id}`)"
        >
          <div class="min-w-0">
            <p class="font-medium text-gray-900 text-sm truncate">{{ payment.student.name }}</p>
            <p v-if="payment.session" class="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <AppIcon name="calendar" class="h-3 w-3 shrink-0" />
              <span class="truncate">{{ formatDate(payment.session.date) }} · {{ payment.session.place }}</span>
            </p>
            <p v-else class="text-xs text-gray-400 mt-0.5">No session</p>
            <p class="text-xs text-gray-400 mt-0.5">
              RM {{ parseFloat(payment.amount).toFixed(2) }} · Uploaded {{ new Date(payment.uploadedAt).toLocaleDateString() }}
            </p>
          </div>
          <span
            class="inline-block rounded-full text-xs px-2 py-0.5 font-medium capitalize shrink-0"
            :class="statusBadge[payment.status]"
          >
            {{ payment.status }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 flex-wrap items-center">
          <a
            :href="getReceiptFullUrl(payment.receiptUrl)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-indigo-600 hover:underline"
          >
            View receipt
          </a>
          <template v-if="payment.status === 'pending'">
            <AppButton
              variant="secondary"
              :disabled="reviewingId === payment.id"
              @click="quickReview(payment.id, 'approve')"
            >
              <AppIcon v-if="reviewingId !== payment.id" name="check" class="h-4 w-4" />
              {{ reviewingId === payment.id ? '…' : 'Approve' }}
            </AppButton>
            <AppButton
              variant="danger"
              :disabled="reviewingId === payment.id"
              @click="quickReview(payment.id, 'reject')"
            >
              <AppIcon v-if="reviewingId !== payment.id" name="x-mark" class="h-4 w-4" />
              {{ reviewingId === payment.id ? '…' : 'Reject' }}
            </AppButton>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
