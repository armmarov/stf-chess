<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { toHHMM, formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'

const sessionStore = useSessionStore()
const auth = useAuthStore()
const router = useRouter()

const isStudent = computed(() => auth.user?.role === 'student')

const from = ref('')
const to = ref('')
const showCancelled = ref(false)

const canManage = computed(() =>
  auth.user?.role === 'admin' || auth.user?.role === 'teacher',
)

async function load() {
  await sessionStore.fetchSessions({
    from: from.value || undefined,
    to: to.value || undefined,
    includeCancelled: showCancelled.value,
  })
}

onMounted(load)
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900">Sessions</h1>
      <AppButton v-if="canManage" @click="router.push('/sessions/new')">
        + New Session
      </AppButton>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="flex-1 flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">From</label>
        <input
          v-model="from"
          type="date"
          class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>
      <div class="flex-1 flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">To</label>
        <input
          v-model="to"
          type="date"
          class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input v-model="showCancelled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
        Show cancelled
      </label>
      <AppButton variant="secondary" @click="load">Filter</AppButton>
    </div>

    <!-- Loading -->
    <div v-if="sessionStore.loading" class="text-center py-10 text-gray-400 text-sm">
      Loading sessions…
    </div>

    <!-- Empty -->
    <div
      v-else-if="sessionStore.sessions.length === 0"
      class="text-center py-10 text-gray-400 text-sm"
    >
      No sessions found.
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="session in sessionStore.sessions"
        :key="session.id"
        class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors"
        @click="router.push(`/sessions/${session.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-medium text-gray-900 text-sm">{{ formatDate(session.date) }}</p>
            <p class="text-sm text-gray-600 mt-0.5">
              {{ toHHMM(session.startTime) }} – {{ toHHMM(session.endTime) }} · {{ session.place }}
            </p>
            <p v-if="session.notes" class="text-xs text-gray-400 mt-1 line-clamp-1">
              {{ session.notes }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span
              v-if="session.isCancelled"
              class="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium"
            >
              Cancelled
            </span>
            <span
              v-if="isStudent && session.myPreAttended"
              class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium"
            >
              Pre-attended
            </span>
            <span class="text-xs text-gray-400">
              {{ session._count.preAttendances }} confirmed
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
