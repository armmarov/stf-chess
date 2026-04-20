import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as configApi from '@/api/config'

export const useConfigStore = defineStore('config', () => {
  const fee = ref<number | null>(null)
  const loading = ref(false)

  async function fetchFee(): Promise<void> {
    loading.value = true
    try {
      fee.value = await configApi.getFee()
    } finally {
      loading.value = false
    }
  }

  async function updateFee(newFee: number): Promise<void> {
    loading.value = true
    try {
      fee.value = await configApi.setFee(newFee)
    } finally {
      loading.value = false
    }
  }

  function $reset() {
    fee.value = null
    loading.value = false
  }

  return { fee, loading, fetchFee, updateFee, $reset }
})
