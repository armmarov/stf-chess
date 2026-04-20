<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToastStore } from '@/stores/toastStore'
import { listPaymentHistory, downloadHistoryReceipt, getReceiptFullUrl } from '@/api/payments'
import type { HistoryEntry } from '@/api/payments'
import { formatDate, sessionSerial } from '@/utils/format'
import AppIcon from '@/components/AppIcon.vue'

const toastStore = useToastStore()

const entries = ref<HistoryEntry[]>([])
const loading = ref(false)
const downloadingId = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    entries.value = await listPaymentHistory()
  } catch {
    toastStore.show('Failed to load payment history.', 'error')
  } finally {
    loading.value = false
  }
})

async function downloadReceipt(entry: HistoryEntry) {
  if (downloadingId.value) return
  downloadingId.value = entry.id
  try {
    const blob = await downloadHistoryReceipt(entry.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${entry.sessionDate}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toastStore.show('Failed to download receipt.', 'error')
  } finally {
    downloadingId.value = null
  }
}

function viewUploadedReceipt(paymentId: string) {
  window.open(getReceiptFullUrl(`/api/payments/${paymentId}/receipt`), '_blank')
}

const statusBadge: Record<HistoryEntry['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const statusLabel: Record<HistoryEntry['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="dollar" class="h-5 w-5 text-indigo-600" />
        My Payments
      </h1>
      <p class="text-xs text-gray-500 mt-0.5">View your payment history.</p>
    </div>

    <div v-if="loading" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="entries.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No payments yet.
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="bg-white rounded-lg border border-gray-200 p-4"
      >
        <!-- Row 1: session date + place -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="min-w-0">
            <p class="font-medium text-gray-900 text-sm">{{ formatDate(entry.sessionDate) }}</p>
            <code class="text-[10px] text-gray-400 font-mono mt-0.5">{{ sessionSerial(entry.sessionId, entry.sessionDate) }}</code>
          </div>
        </div>

        <!-- Row 2: method badge + status badge + amount + date -->
        <div class="flex items-center gap-2 flex-wrap mb-3">
          <span
            class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium capitalize"
            :class="entry.method === 'cash' ? 'bg-gray-100 text-gray-700' : 'bg-indigo-100 text-indigo-700'"
          >
            <AppIcon name="tag" class="h-3 w-3" />
            {{ entry.method === 'cash' ? 'Cash' : 'Online' }}
          </span>
          <span
            class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium"
            :class="statusBadge[entry.status]"
          >
            {{ statusLabel[entry.status] }}
          </span>
          <span class="inline-flex items-center gap-0.5 text-xs text-gray-600">
            <AppIcon name="dollar" class="h-3 w-3 text-gray-400" />
            RM {{ parseFloat(entry.amount).toFixed(2) }}
          </span>
          <span class="inline-flex items-center gap-0.5 text-xs text-gray-400">
            <AppIcon name="clock" class="h-3 w-3" />
            {{ new Date(entry.paidAt).toLocaleDateString() }}
          </span>
        </div>

        <!-- Row 3: status-aware actions -->
        <div class="flex flex-wrap gap-3 items-center">
          <!-- Approved: download receipt -->
          <template v-if="entry.status === 'approved'">
            <button
              class="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline disabled:opacity-50"
              :disabled="downloadingId === entry.id"
              @click="downloadReceipt(entry)"
            >
              <AppIcon v-if="downloadingId !== entry.id" name="download" class="h-3.5 w-3.5" />
              {{ downloadingId === entry.id ? 'Downloading…' : 'Download Receipt' }}
            </button>
          </template>

          <!-- Pending online: view uploaded + under review badge -->
          <template v-else-if="entry.status === 'pending' && entry.method === 'online' && entry.paymentId">
            <button
              class="text-xs text-indigo-600 hover:underline"
              @click="viewUploadedReceipt(entry.paymentId!)"
            >
              View uploaded receipt
            </button>
            <span class="inline-flex items-center rounded-full bg-gray-100 text-gray-500 text-xs px-2 py-0.5 font-medium">
              Under review
            </span>
          </template>

          <!-- Rejected online: view uploaded + re-upload link -->
          <template v-else-if="entry.status === 'rejected' && entry.method === 'online' && entry.paymentId">
            <button
              class="text-xs text-indigo-600 hover:underline"
              @click="viewUploadedReceipt(entry.paymentId!)"
            >
              View uploaded receipt
            </button>
            <RouterLink
              :to="`/sessions/${entry.sessionId}`"
              class="text-xs text-indigo-600 hover:underline"
            >
              Re-upload from session
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
