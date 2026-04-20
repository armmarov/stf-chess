import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as paymentsApi from '@/api/payments'
import type { Payment, ListPaymentsQuery, PaymentStatus } from '@/api/payments'

export type { Payment, PaymentStatus }

export const usePaymentStore = defineStore('payments', () => {
  // Cache keyed by serialised query
  const listCache = ref<Record<string, Payment[]>>({})
  const current = ref<Payment | null>(null)
  const loading = ref(false)

  function cacheKey(query?: ListPaymentsQuery) {
    return `${query?.status ?? 'all'}_${query?.sessionId ?? 'all'}`
  }

  async function fetchPayments(query?: ListPaymentsQuery): Promise<void> {
    loading.value = true
    try {
      const payments = await paymentsApi.listPayments(query)
      listCache.value[cacheKey(query)] = payments
    } finally {
      loading.value = false
    }
  }

  async function fetchPayment(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await paymentsApi.getPayment(id)
    } finally {
      loading.value = false
    }
  }

  async function uploadPayment(sessionId: string, file: File): Promise<Payment> {
    const payment = await paymentsApi.uploadPayment(sessionId, file)
    listCache.value = {}
    return payment
  }

  async function reviewPayment(
    id: string,
    decision: 'approve' | 'reject',
    note?: string,
  ): Promise<Payment> {
    const payment = await paymentsApi.reviewPayment(id, decision, note)
    if (current.value?.id === id) current.value = payment
    // Update in-place across all cached lists
    for (const key of Object.keys(listCache.value)) {
      const idx = listCache.value[key].findIndex((p) => p.id === id)
      if (idx !== -1) listCache.value[key][idx] = payment
    }
    return payment
  }

  function $reset() {
    listCache.value = {}
    current.value = null
    loading.value = false
  }

  return { listCache, current, loading, cacheKey, fetchPayments, fetchPayment, uploadPayment, reviewPayment, $reset }
})
