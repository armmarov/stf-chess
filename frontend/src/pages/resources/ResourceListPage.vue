<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useResourceStore } from '@/stores/resourceStore'
import { useAuthStore } from '@/stores/authStore'
import { resourceImageUrl } from '@/api/resources'
import type { ResourceType } from '@/api/resources'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const resourceStore = useResourceStore()
const auth = useAuthStore()

const isAdmin = computed(() => auth.user?.role === 'admin')

type FilterType = 'all' | ResourceType
const activeFilter = ref<FilterType>('all')

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

const TYPE_ICONS: Record<ResourceType, string> = {
  book: 'book',
  homework: 'document',
  app: 'link',
}

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'book', label: 'Book' },
  { key: 'homework', label: 'Homework' },
  { key: 'app', label: 'App' },
]

const displayList = computed(() => {
  const items = isAdmin.value
    ? resourceStore.list
    : resourceStore.list.filter((r) => r.isEnabled)
  if (activeFilter.value === 'all') return items
  return items.filter((r) => r.type === activeFilter.value)
})

onMounted(() => resourceStore.fetchList())
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="book" class="h-5 w-5 text-indigo-600" />
        Resources
      </h1>
      <AppButton v-if="isAdmin" @click="router.push('/admin/resources/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New Resource
      </AppButton>
    </div>

    <!-- Type filter pills -->
    <div class="flex gap-2 flex-wrap mb-4">
      <button
        v-for="f in filters"
        :key="f.key"
        type="button"
        class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
        :class="activeFilter === f.key
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="resourceStore.loading && resourceStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="displayList.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No resources found.
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="resource in displayList"
        :key="resource.id"
        class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors flex gap-3"
        :class="!resource.isEnabled ? 'opacity-60' : ''"
        @click="router.push(`/resources/${resource.id}`)"
      >
        <!-- Thumbnail -->
        <div class="shrink-0">
          <img
            v-if="resource.hasImage"
            :src="resourceImageUrl(resource.id)"
            :alt="resource.title"
            class="h-14 w-14 object-cover rounded-lg"
          />
          <div
            v-else
            class="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center"
          >
            <AppIcon :name="TYPE_ICONS[resource.type]" class="h-6 w-6 text-gray-400" />
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium text-gray-900 text-sm leading-snug">{{ resource.title }}</p>
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="!resource.isEnabled && isAdmin"
                class="inline-block rounded-full bg-gray-200 text-gray-500 text-xs px-2 py-0.5 font-medium"
              >
                Disabled
              </span>
              <span
                class="inline-block rounded-full text-xs px-2 py-0.5 font-medium"
                :class="TYPE_COLORS[resource.type]"
              >
                {{ TYPE_LABELS[resource.type] }}
              </span>
            </div>
          </div>
          <p
            v-if="resource.description"
            class="text-xs text-gray-500 mt-1 line-clamp-2"
          >{{ resource.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
