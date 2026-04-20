<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useResourceStore } from '@/stores/resourceStore'
import { useToastStore } from '@/stores/toastStore'
import { resourceImageUrl } from '@/api/resources'
import type { ResourceType } from '@/api/resources'
import AppInput from '@/components/AppInput.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const resourceStore = useResourceStore()
const toastStore = useToastStore()

const resourceId = route.params.id as string | undefined
const isEdit = !!resourceId
const resource = computed(() => resourceStore.current)

const title = ref('')
const type = ref<ResourceType | ''>('')
const description = ref('')
const url = ref('')
const isEnabled = ref(true)

const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const removeImage = ref(false)

const attachedFile = ref<File | null>(null)
const attachedFileName = ref('')
const removeFile = ref(false)

const submitting = ref(false)

const TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'homework', label: 'Homework' },
  { value: 'app', label: 'App' },
]

function handleImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
  removeImage.value = false
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  attachedFile.value = file
  attachedFileName.value = file.name
  removeFile.value = false
}

onBeforeUnmount(() => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
})

onMounted(async () => {
  if (isEdit && resourceId) {
    await resourceStore.fetchResource(resourceId)
    if (resource.value) {
      title.value = resource.value.title
      type.value = resource.value.type
      description.value = resource.value.description ?? ''
      url.value = resource.value.url ?? ''
      isEnabled.value = resource.value.isEnabled
    }
  }
})

const canSubmit = computed(() => {
  return !!title.value.trim() && !!type.value
})

async function handleSubmit() {
  if (!canSubmit.value || !type.value) return
  submitting.value = true
  try {
    if (isEdit && resourceId) {
      await resourceStore.update(resourceId, {
        title: title.value.trim(),
        type: type.value,
        description: description.value.trim() || null,
        url: url.value.trim() || null,
        isEnabled: isEnabled.value,
        image: imageFile.value ?? undefined,
        file: attachedFile.value ?? undefined,
        removeImage: removeImage.value || undefined,
        removeFile: removeFile.value || undefined,
      })
      toastStore.show('Resource updated.', 'success')
      router.push(`/resources/${resourceId}`)
    } else {
      const created = await resourceStore.create({
        title: title.value.trim(),
        type: type.value,
        description: description.value.trim() || undefined,
        url: url.value.trim() || undefined,
        isEnabled: isEnabled.value,
        image: imageFile.value ?? undefined,
        file: attachedFile.value ?? undefined,
      })
      toastStore.show('Resource created.', 'success')
      router.push(`/resources/${created.id}`)
    }
  } catch {
    toastStore.show('Failed to save resource.', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/resources')"
    >
      ← Back to resources
    </button>

    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="book" class="h-5 w-5 text-indigo-600" />
      {{ isEdit ? 'Edit Resource' : 'New Resource' }}
    </h1>

    <div v-if="resourceStore.loading && isEdit && !resource" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Core fields -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
        <AppInput v-model="title" label="Title" placeholder="Resource title" required />

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">
            Type <span class="text-red-500">*</span>
          </label>
          <select
            v-model="type"
            required
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="" disabled>Select type…</option>
            <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Description (optional)</label>
          <textarea
            v-model="description"
            rows="3"
            placeholder="Short description…"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none"
          />
        </div>

        <AppInput v-model="url" label="URL (optional)" placeholder="https://…" type="url" />

        <!-- isEnabled toggle -->
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700">Enabled</span>
          <button
            type="button"
            role="switch"
            :aria-checked="isEnabled"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            :class="isEnabled ? 'bg-indigo-600' : 'bg-gray-200'"
            @click="isEnabled = !isEnabled"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
              :class="isEnabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </div>

      <!-- Image -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
        <p class="text-sm font-semibold text-gray-900">Image (optional)</p>

        <div v-if="imagePreviewUrl || (isEdit && resource?.hasImage && !removeImage)" class="flex items-center gap-3">
          <img
            :src="imagePreviewUrl || resourceImageUrl(resourceId!)"
            alt="Preview"
            class="h-20 w-20 object-cover rounded-lg shrink-0"
          />
          <div v-if="isEdit && resource?.hasImage && !imageFile" class="flex items-center gap-2">
            <input id="remove-image" v-model="removeImage" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <label for="remove-image" class="text-sm text-red-600 cursor-pointer">Remove image</label>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          class="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          @change="handleImageChange"
        />
      </div>

      <!-- File -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
        <p class="text-sm font-semibold text-gray-900">File attachment (optional)</p>

        <div v-if="isEdit && resource?.hasFile && !attachedFile" class="flex items-center gap-2">
          <AppIcon name="document" class="h-4 w-4 text-gray-400 shrink-0" />
          <span class="text-sm text-gray-600 truncate">{{ resource.fileName ?? 'File attached' }}</span>
          <div class="flex items-center gap-2 ml-auto">
            <input id="remove-file" v-model="removeFile" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <label for="remove-file" class="text-sm text-red-600 cursor-pointer">Remove file</label>
          </div>
        </div>
        <p v-if="attachedFileName" class="text-xs text-gray-500 flex items-center gap-1">
          <AppIcon name="document" class="h-3.5 w-3.5 shrink-0" />
          {{ attachedFileName }}
        </p>

        <input
          type="file"
          class="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          @change="handleFileChange"
        />
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <AppButton class="flex-1" :disabled="submitting || !canSubmit" @click="handleSubmit">
          {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Resource' }}
        </AppButton>
        <AppButton variant="secondary" class="flex-1" :disabled="submitting" @click="router.push('/resources')">
          Cancel
        </AppButton>
      </div>
    </div>
  </div>
</template>
