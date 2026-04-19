<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { useToastStore } from '@/stores/toastStore'
import type { PaymentStatus } from '@/stores/paymentStore'
import AppButton from '@/components/AppButton.vue'
import { formatDate } from '@/utils/format'

const router = useRouter()
const paymentStore = usePaymentStore()
const toastStore = useToastStore()

const payments = computed(() => paymentStore.listCache[paymentStore.cacheKey()] ?? [])

const statusBadge: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

onMounted(async () => {
  try {
    await paymentStore.fetchPayments()
  } catch {
    toastStore.show('Failed to load payments.', 'error')
  }
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900">My Payments</h1>
      <AppButton @click="router.push('/student/payments/new')">+ Upload Receipt</AppButton>
    </div>

    <div v-if="paymentStore.loading" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="payments.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No payments yet.
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="payment in payments"
        :key="payment.id"
        class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors"
        @click="router.push(`/student/payments/${payment.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium text-gray-900 text-sm">
              {{ payment.session ? formatDate(payment.session.date) : 'No session' }}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">
              RM {{ parseFloat(payment.amount).toFixed(2) }} · {{ new Date(payment.uploadedAt).toLocaleDateString() }}
            </p>
            <p v-if="payment.session" class="text-xs text-gray-400 mt-0.5">{{ payment.session.place }}</p>
          </div>
          <span
            class="inline-block rounded-full text-xs px-2 py-0.5 font-medium capitalize shrink-0"
            :class="statusBadge[payment.status]"
          >
            {{ payment.status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
