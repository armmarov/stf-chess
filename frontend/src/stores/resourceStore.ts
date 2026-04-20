import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as resourcesApi from '@/api/resources'
import type { Resource, ResourceListItem } from '@/api/resources'

export type { Resource, ResourceListItem }

export const useResourceStore = defineStore('resources', () => {
  const list = ref<ResourceListItem[]>([])
  const current = ref<Resource | null>(null)
  const loading = ref(false)

  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      list.value = await resourcesApi.listResources()
    } finally {
      loading.value = false
    }
  }

  async function fetchResource(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await resourcesApi.getResource(id)
    } finally {
      loading.value = false
    }
  }

  async function create(body: resourcesApi.CreateResourceBody): Promise<Resource> {
    const resource = await resourcesApi.createResource(body)
    list.value.unshift(resource)
    return resource
  }

  async function update(id: string, body: resourcesApi.UpdateResourceBody): Promise<Resource> {
    const resource = await resourcesApi.updateResource(id, body)
    const idx = list.value.findIndex((r) => r.id === id)
    if (idx !== -1) list.value[idx] = resource
    if (current.value?.id === id) current.value = resource
    return resource
  }

  async function remove(id: string): Promise<void> {
    await resourcesApi.deleteResource(id)
    list.value = list.value.filter((r) => r.id !== id)
    if (current.value?.id === id) current.value = null
  }

  function $reset() {
    list.value = []
    current.value = null
    loading.value = false
  }

  return { list, current, loading, fetchList, fetchResource, create, update, remove, $reset }
})
