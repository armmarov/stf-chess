<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useResourceStore } from '@/stores/resourceStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { resourceImageUrl, downloadFile } from '@/api/resources'
import type { ResourceType } from '@/api/resources'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const resourceStore = useResourceStore()
const auth = useAuthStore()
const toastStore = useToastStore()
const { confirm } = useConfirm()

const id = route.params.id as string
const resource = computed(() => resourceStore.current)

const isAdmin = computed(() => auth.user?.role === 'admin')
const lightboxOpen = ref(false)
const downloading = ref(false)

const TYPE_LABELS: Record<ResourceType, string> = {
  book: 'Book',
  homework: 'Homework',
  app: 'App',
}

const TYPE_COLORS: Record<ResourceType, string> = {
  book: 'bg-blue-100 text-blue-700',
  homework: 'bg-amber-100 text-amber-700',
  app: 'bg-emerald-100 text-emerald-700',
}

async function handleDownload() {
  downloading.value = true
  try {
    await downloadFile(id)
  } catch {
    toastStore.show('Failed to download file.', 'error')
  } finally {
    downloading.value = false
  }
}

async function handleDelete() {
  const ok = await confirm({
    title: 'Delete resource?',
    message: 'This will permanently remove the resource and its files.',
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await resourceStore.remove(id)
    toastStore.show('Resource deleted.', 'success')
    router.push('/resources')
  } catch {
    toastStore.show('Failed to delete resource.', 'error')
  }
}

onMounted(() => resourceStore.fetchResource(id))
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/resources')"
    >
      ← Back to resources
    </button>

    <div v-if="resourceStore.loading && !resource" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="resource" class="flex flex-col gap-4">
      <!-- Header card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1 min-w-0">
            <h1 class="text-lg font-semibold text-gray-900">{{ resource.title }}</h1>
            <span
              class="inline-block rounded-full text-xs px-2 py-0.5 font-medium mt-1"
              :class="TYPE_COLORS[resource.type]"
            >
              {{ TYPE_LABELS[resource.type] }}
            </span>
          </div>
          <div v-if="isAdmin" class="flex gap-1.5 shrink-0">
            <AppButton variant="secondary" @click="router.push(`/admin/resources/${id}/edit`)">
              <AppIcon name="edit" class="h-4 w-4" />
            </AppButton>
            <AppButton variant="danger" @click="handleDelete">
              <AppIcon name="trash" class="h-4 w-4" />
            </AppButton>
          </div>
        </div>

        <!-- Image -->
        <div v-if="resource.hasImage" class="mb-3">
          <img
            :src="resourceImageUrl(resource.id)"
            :alt="resource.title"
            class="w-full max-h-64 object-cover rounded-lg cursor-zoom-in"
            @click="lightboxOpen = true"
          />
        </div>

        <p v-if="resource.description" class="text-sm text-gray-600 whitespace-pre-wrap">
          {{ resource.description }}
        </p>
      </div>

      <!-- Action row -->
      <div
        v-if="resource.url || resource.hasFile"
        class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2"
      >
        <a
          v-if="resource.url"
          :href="resource.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-indigo-700 transition-colors"
        >
          <AppIcon name="link" class="h-4 w-4" />
          Open Link
        </a>
        <AppButton
          v-if="resource.hasFile"
          variant="secondary"
          class="w-full"
          :disabled="downloading"
          @click="handleDownload"
        >
          <AppIcon name="download" class="h-4 w-4" />
          {{ downloading ? 'Downloading…' : resource.fileName ? `Download ${resource.fileName}` : 'Download' }}
        </AppButton>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Resource not found.</div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen && resource?.hasImage"
        class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        @click="lightboxOpen = false"
      >
        <img
          :src="resourceImageUrl(id)"
          :alt="resource?.title"
          class="max-w-full max-h-full object-contain rounded-lg"
          @click.stop
        />
        <button
          class="absolute top-4 right-4 text-white/80 hover:text-white"
          @click="lightboxOpen = false"
        >
          <AppIcon name="x-mark" class="h-6 w-6" />
        </button>
      </div>
    </Teleport>
  </div>
</template>
