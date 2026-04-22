<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const activeTab = ref<'upcoming' | 'past'>('upcoming')

function pajskBadgeClass(target: string): string {
  const map: Record<string, string> = {
    sekolah: 'bg-gray-100 text-gray-700',
    daerah: 'bg-blue-100 text-blue-700',
    negeri: 'bg-purple-100 text-purple-700',
    kebangsaan: 'bg-orange-100 text-orange-700',
    antarabangsa: 'bg-red-100 text-red-700',
  }
  return map[target] ?? 'bg-green-100 text-green-700'
}

async function toggleInterest(id: string, currentValue: boolean | undefined) {
  try {
    await tournamentStore.toggleInterest(id, !currentValue)
  } catch {
    toastStore.show('Failed to update interest.', 'error')
  }
}

onMounted(() => tournamentStore.fetchList())

// Split tournaments into upcoming (today or later) and past.
// Cutoff prefers endDate; falls back to startDate. Tournaments with no
// dates at all are treated as upcoming (undated).
function cutoffDate(t: { startDate: string | null; endDate: string | null }): string | null {
  return t.endDate ?? t.startDate
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const upcoming = computed(() => {
  const today = todayIso()
  return tournamentStore.list
    .filter((t) => {
      const c = cutoffDate(t)
      return c === null || c.slice(0, 10) >= today
    })
    .slice()
    .sort((a, b) => {
      const aKey = a.startDate ?? a.endDate ?? '\uffff' // undated → bottom
      const bKey = b.startDate ?? b.endDate ?? '\uffff'
      return aKey.localeCompare(bKey) // asc
    })
})

const past = computed(() => {
  const today = todayIso()
  return tournamentStore.list
    .filter((t) => {
      const c = cutoffDate(t)
      return c !== null && c.slice(0, 10) < today
    })
    .slice()
    .sort((a, b) => {
      const aKey = a.endDate ?? a.startDate ?? ''
      const bKey = b.endDate ?? b.startDate ?? ''
      return bKey.localeCompare(aKey) // desc
    })
})
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

    <template v-else>
      <!-- Tabs -->
      <div class="flex border-b border-gray-200 mb-4" role="tablist">
        <button
          role="tab"
          :aria-selected="activeTab === 'upcoming'"
          class="flex-1 text-sm font-medium py-2 -mb-px border-b-2 transition-colors"
          :class="activeTab === 'upcoming' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'upcoming'"
        >
          Upcoming
          <span class="ml-1 text-xs text-gray-400">({{ upcoming.length }})</span>
        </button>
        <button
          role="tab"
          :aria-selected="activeTab === 'past'"
          class="flex-1 text-sm font-medium py-2 -mb-px border-b-2 transition-colors"
          :class="activeTab === 'past' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'past'"
        >
          Past
          <span class="ml-1 text-xs text-gray-400">({{ past.length }})</span>
        </button>
      </div>

      <!-- Upcoming list -->
      <div v-if="activeTab === 'upcoming'">
        <div v-if="upcoming.length === 0" class="text-center py-10 text-gray-400 text-sm">
          No upcoming tournaments.
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="t in upcoming"
            :key="t.id"
            class="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors"
            @click="router.push(`/tournaments/${t.id}`)"
          >
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
                  <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span class="inline-flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 font-medium">
                      <AppIcon name="calendar" class="h-3 w-3 shrink-0" />
                      {{ formatDate(t.startDate) }}
                    </span>
                    <span
                      v-if="t.targetPajsk && t.targetPajsk !== 'tiada'"
                      class="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium capitalize"
                      :class="pajskBadgeClass(t.targetPajsk)"
                    >
                      PAJSK · {{ t.targetPajsk }}
                    </span>
                  </div>
                  <span v-if="t.place" class="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 max-w-full">
                    <AppIcon name="map-pin" class="h-3 w-3 shrink-0 text-gray-400" />
                    <span class="truncate">{{ t.place }}</span>
                  </span>
                  <p v-if="t.description" class="text-sm text-gray-500 mt-1.5 line-clamp-2">{{ t.description }}</p>
                </div>
                <span class="text-gray-400 text-sm shrink-0 mt-0.5">→</span>
              </div>
              <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
                <span class="text-xs text-gray-400">{{ t.interestCount }} interested</span>
                <label v-if="isStudent" class="flex items-center gap-1.5 cursor-pointer select-none" @click.stop>
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

      <!-- Past list -->
      <div v-else>
        <div v-if="past.length === 0" class="text-center py-10 text-gray-400 text-sm">
          No past tournaments.
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="t in past"
            :key="t.id"
            class="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors opacity-75"
            @click="router.push(`/tournaments/${t.id}`)"
          >
            <img
              v-if="t.hasImage"
              :src="tournamentImageUrl(t.id)"
              :alt="t.name"
              class="w-full h-36 object-cover grayscale"
            />
            <div class="p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-gray-900 text-sm">{{ t.name }}</p>
                  <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span class="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 font-medium">
                      <AppIcon name="calendar" class="h-3 w-3 shrink-0" />
                      {{ formatDate(t.startDate) }}
                    </span>
                    <span
                      v-if="t.targetPajsk && t.targetPajsk !== 'tiada'"
                      class="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium capitalize"
                      :class="pajskBadgeClass(t.targetPajsk)"
                    >
                      PAJSK · {{ t.targetPajsk }}
                    </span>
                  </div>
                  <span v-if="t.place" class="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 max-w-full">
                    <AppIcon name="map-pin" class="h-3 w-3 shrink-0 text-gray-400" />
                    <span class="truncate">{{ t.place }}</span>
                  </span>
                  <p v-if="t.description" class="text-sm text-gray-500 mt-1.5 line-clamp-2">{{ t.description }}</p>
                </div>
                <span class="text-gray-400 text-sm shrink-0 mt-0.5">→</span>
              </div>
              <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
                <span class="text-xs text-gray-400">{{ t.interestCount }} joined</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
