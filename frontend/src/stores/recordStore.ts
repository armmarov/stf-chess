import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as recordsApi from '@/api/records'
import type { CompetitionRecord, CreateRecordBody, UpdateRecordBody } from '@/api/records'

export type { CompetitionRecord }

export const useRecordStore = defineStore('records', () => {
  const list = ref<CompetitionRecord[]>([])
  const current = ref<CompetitionRecord | null>(null)
  const loading = ref(false)

  async function fetchList(filter?: { studentId?: string }): Promise<void> {
    loading.value = true
    try {
      list.value = await recordsApi.listRecords(filter)
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await recordsApi.getRecord(id)
    } finally {
      loading.value = false
    }
  }

  async function create(body: CreateRecordBody): Promise<CompetitionRecord> {
    const record = await recordsApi.createRecord(body)
    list.value.unshift(record)
    return record
  }

  async function update(id: string, patch: UpdateRecordBody): Promise<CompetitionRecord> {
    const record = await recordsApi.updateRecord(id, patch)
    const idx = list.value.findIndex((r) => r.id === id)
    if (idx !== -1) list.value[idx] = record
    if (current.value?.id === id) current.value = record
    return record
  }

  async function remove(id: string): Promise<void> {
    await recordsApi.deleteRecord(id)
    list.value = list.value.filter((r) => r.id !== id)
    if (current.value?.id === id) current.value = null
  }

  function $reset() {
    list.value = []
    current.value = null
    loading.value = false
  }

  return { list, current, loading, fetchList, fetchOne, create, update, remove, $reset }
})
