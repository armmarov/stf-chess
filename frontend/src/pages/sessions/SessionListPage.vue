<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { toHHMM, formatDate, sessionSerial } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

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
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="calendar" class="h-5 w-5 text-indigo-600" />
        Sessions
      </h1>
      <AppButton v-if="canManage" @click="router.push('/sessions/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New Session
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
      <div class="flex items-end gap-3">
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer h-[38px]">
          <input v-model="showCancelled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          Show cancelled
        </label>
        <AppButton variant="secondary" @click="load">Filter</AppButton>
      </div>
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
            <p class="font-medium text-gray-900 text-sm flex items-center gap-1.5">
              <AppIcon name="calendar" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {{ formatDate(session.date) }}
            </p>
            <p class="text-sm text-gray-600 mt-0.5 flex items-center gap-3">
              <span class="flex items-center gap-1.5">
                <AppIcon name="clock" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
                {{ toHHMM(session.startTime) }} – {{ toHHMM(session.endTime) }}
              </span>
              <span class="flex items-center gap-1.5 min-w-0">
                <AppIcon name="map-pin" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span class="truncate">{{ session.place }}</span>
              </span>
            </p>
            <p v-if="session.notes" class="text-xs text-gray-400 mt-1 flex items-start gap-1.5">
              <AppIcon name="document" class="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span class="whitespace-pre-wrap break-words">{{ session.notes }}</span>
            </p>
            <p class="flex items-center gap-1.5 mt-0.5 leading-none">
              <AppIcon name="hash" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <code class="text-[11px] text-gray-400 font-mono leading-none">{{ sessionSerial(session.id, session.date) }}</code>
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
