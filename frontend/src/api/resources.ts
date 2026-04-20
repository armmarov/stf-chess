import apiClient from './client'

export type ResourceType = 'book' | 'homework' | 'app'

export interface ResourceListItem {
  id: string
  title: string
  type: ResourceType
  description: string | null
  hasImage: boolean
  hasFile: boolean
  fileName: string | null
  url: string | null
  isEnabled: boolean
}

export type Resource = ResourceListItem

export interface CreateResourceBody {
  title: string
  type: ResourceType
  description?: string
  url?: string
  isEnabled: boolean
  image?: File
  file?: File
}

export interface UpdateResourceBody {
  title?: string
  type?: ResourceType
  description?: string | null
  url?: string | null
  isEnabled?: boolean
  image?: File
  file?: File
  removeImage?: boolean
  removeFile?: boolean
}

export function resourceImageUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  const origin = new URL(base).origin
  return `${origin}/api/resources/${id}/image`
}

export async function listResources(): Promise<ResourceListItem[]> {
  const { data } = await apiClient.get<{ resources: ResourceListItem[] }>('/resources')
  return data.resources
}

export async function getResource(id: string): Promise<Resource> {
  const { data } = await apiClient.get<{ resource: Resource }>(`/resources/${id}`)
  return data.resource
}

export async function createResource(body: CreateResourceBody): Promise<Resource> {
  const form = new FormData()
  form.append('title', body.title)
  form.append('type', body.type)
  if (body.description) form.append('description', body.description)
  if (body.url) form.append('url', body.url)
  form.append('isEnabled', body.isEnabled ? 'true' : 'false')
  if (body.image) form.append('image', body.image)
  if (body.file) form.append('file', body.file)
  const { data } = await apiClient.post<{ resource: Resource }>('/resources', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.resource
}

export async function updateResource(id: string, body: UpdateResourceBody): Promise<Resource> {
  const form = new FormData()
  if (body.title !== undefined) form.append('title', body.title)
  if (body.type !== undefined) form.append('type', body.type)
  if (body.description !== undefined) form.append('description', body.description ?? '')
  if (body.url !== undefined) form.append('url', body.url ?? '')
  if (body.isEnabled !== undefined) form.append('isEnabled', body.isEnabled ? 'true' : 'false')
  if (body.image) form.append('image', body.image)
  if (body.file) form.append('file', body.file)
  if (body.removeImage) form.append('removeImage', 'true')
  if (body.removeFile) form.append('removeFile', 'true')
  const { data } = await apiClient.patch<{ resource: Resource }>(`/resources/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.resource
}

export async function deleteResource(id: string): Promise<void> {
  await apiClient.delete(`/resources/${id}`)
}

export async function downloadFile(id: string): Promise<void> {
  const response = await apiClient.get(`/resources/${id}/file`, { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] as string | undefined
  let filename = `resource-${id}`
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i)
    if (match?.[1]) filename = decodeURIComponent(match[1].trim())
  }
  const url = URL.createObjectURL(response.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
