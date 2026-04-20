<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { tournamentImageUrl } from '@/api/tournaments'
import { formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const tournamentStore = useTournamentStore()
const auth = useAuthStore()
const toastStore = useToastStore()
const router = useRouter()

const isAdmin = computed(() => auth.user?.role === 'admin')
const isStudent = computed(() => auth.user?.role === 'student')

async function toggleInterest(id: string, currentValue: boolean | undefined) {
  try {
    await tournamentStore.toggleInterest(id, !currentValue)
  } catch {
    toastStore.show('Failed to update interest.', 'error')
  }
}

onMounted(() => tournamentStore.fetchList())
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="trophy" class="h-5 w-5 text-indigo-600" />
        Tournaments
      </h1>
      <AppButton v-if="isAdmin" @click="router.push('/admin/tournaments/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New
      </AppButton>
    </div>

    <div v-if="tournamentStore.loading && tournamentStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="!tournamentStore.loading && tournamentStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No tournaments found.
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="t in tournamentStore.list"
        :key="t.id"
        class="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors"
        @click="router.push(`/tournaments/${t.id}`)"
      >
        <!-- Thumbnail -->
        <img
          v-if="t.hasImage"
          :src="tournamentImageUrl(t.id)"
          :alt="t.name"
          class="w-full h-36 object-cover"
        />

        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 text-sm">{{ t.name }}</p>
              <span class="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 mt-1.5 font-medium">
                <AppIcon name="calendar" class="h-3 w-3 shrink-0" />
                {{ formatDate(t.startDate) }}
              </span>
              <p v-if="t.description" class="text-sm text-gray-500 mt-1.5 line-clamp-2">{{ t.description }}</p>
            </div>
            <span class="text-gray-400 text-sm shrink-0 mt-0.5">→</span>
          </div>

          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
            <span class="text-xs text-gray-400">{{ t.interestCount }} interested</span>
            <label
              v-if="isStudent"
              class="flex items-center gap-1.5 cursor-pointer select-none"
              @click.stop
            >
              <input
                type="checkbox"
                :checked="t.myInterested"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                @change="toggleInterest(t.id, t.myInterested)"
              />
              <span class="text-xs text-gray-600">I want to join</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
