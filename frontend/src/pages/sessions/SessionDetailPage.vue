<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useAttendanceStore } from '@/stores/attendanceStore'
import { useToastStore } from '@/stores/toastStore'
import { toHHMM, formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const auth = useAuthStore()
const attendanceStore = useAttendanceStore()
const toastStore = useToastStore()

const id = route.params.id as string
const confirmingCancel = ref(false)
const cancelling = ref(false)
const cancelError = ref('')
const preAttendToggling = ref(false)

const isStudent = computed(() => auth.user?.role === 'student')
const canManage = computed(() =>
  auth.user?.role === 'admin' || auth.user?.role === 'teacher',
)

const session = computed(() => sessionStore.current)

// After a toggle the store holds the up-to-date value; before any toggle use the server-supplied field
const preAttended = computed(() => {
  if (id in attendanceStore.preAttendanceBySession) {
    return attendanceStore.preAttendanceBySession[id]
  }
  return session.value?.myPreAttended ?? false
})

const canPreAttend = computed(() => {
  if (!session.value || session.value.isCancelled) return false
  const cutoffMs = new Date(session.value.startTime).getTime() - 10 * 60 * 1000
  return Date.now() < cutoffMs
})

const preAttendCutoffLabel = computed(() => {
  if (!session.value) return ''
  const cutoff = new Date(new Date(session.value.startTime).getTime() - 10 * 60 * 1000)
  return cutoff.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
})

async function togglePreAttend() {
  if (preAttendToggling.value) return
  preAttendToggling.value = true
  try {
    await attendanceStore.togglePreAttendance(id, !preAttended.value)
  } catch {
    toastStore.show('Could not update pre-attendance. Please try again.', 'error')
  } finally {
    preAttendToggling.value = false
  }
}

async function confirmCancel() {
  cancelling.value = true
  cancelError.value = ''
  try {
    await sessionStore.cancelSession(id)
    confirmingCancel.value = false
  } catch {
    cancelError.value = 'Failed to cancel session. Please try again.'
  } finally {
    cancelling.value = false
  }
}

onMounted(() => sessionStore.fetchSession(id))
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/sessions')"
    >
      ← Back to sessions
    </button>

    <div v-if="sessionStore.loading && !session" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="session" class="flex flex-col gap-4">
      <!-- Main card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <h1 class="text-lg font-semibold text-gray-900">
              {{ formatDate(session.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
            </h1>
            <p class="text-sm text-gray-600 mt-0.5">
              {{ toHHMM(session.startTime) }} – {{ toHHMM(session.endTime) }}
            </p>
          </div>
          <span
            v-if="session.isCancelled"
            class="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium shrink-0"
          >
            Cancelled
          </span>
        </div>

        <!-- Details -->
        <dl class="flex flex-col gap-3 text-sm border-t border-gray-100 pt-4">
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide">Place</dt>
            <dd class="text-gray-900 mt-0.5">{{ session.place }}</dd>
          </div>
          <div v-if="session.notes">
            <dt class="text-xs text-gray-500 uppercase tracking-wide">Notes</dt>
            <dd class="text-gray-900 mt-0.5 whitespace-pre-line">{{ session.notes }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide">Pre-Attendance</dt>
            <dd class="text-gray-900 mt-0.5">{{ session._count.preAttendances }} student(s) confirmed</dd>
          </div>
          <div v-if="session.createdBy">
            <dt class="text-xs text-gray-500 uppercase tracking-wide">Created by</dt>
            <dd class="text-gray-900 mt-0.5">{{ session.createdBy.name }}</dd>
          </div>
          <div v-if="session.isCancelled && session.cancelledBy">
            <dt class="text-xs text-gray-500 uppercase tracking-wide">Cancelled by</dt>
            <dd class="text-gray-900 mt-0.5">{{ session.cancelledBy.name }}</dd>
          </div>
        </dl>
      </div>

      <!-- Student: Pre-attendance toggle -->
      <div
        v-if="isStudent"
        class="bg-white rounded-lg border border-gray-200 p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900">
              {{ preAttended ? 'You are attending' : 'Will you attend?' }}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">
              <template v-if="session.isCancelled">
                Session is cancelled.
              </template>
              <template v-else-if="canPreAttend">
                Pre-attendance closes at {{ preAttendCutoffLabel }}.
              </template>
              <template v-else>
                Pre-attendance is closed (10 min before start).
              </template>
            </p>
          </div>

          <!-- Toggle button -->
          <button
            :disabled="!canPreAttend || preAttendToggling"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="preAttended ? 'bg-indigo-600' : 'bg-gray-200'"
            :aria-checked="preAttended"
            role="switch"
            :aria-label="preAttended ? 'Cancel pre-attendance' : 'Confirm attendance'"
            @click="togglePreAttend"
          >
            <span
              class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
              :class="preAttended ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>

      <!-- Admin/teacher actions -->
      <div v-if="canManage" class="flex flex-col gap-3">
        <!-- Mark Attendance button -->
        <AppButton
          variant="secondary"
          class="w-full"
          @click="router.push(`/sessions/${id}/attendance`)"
        >
          Mark Attendance
        </AppButton>

        <!-- Edit / Cancel (non-cancelled sessions only) -->
        <div v-if="!session.isCancelled">
          <div v-if="!confirmingCancel" class="flex gap-3">
            <AppButton @click="router.push(`/sessions/${id}/edit`)">Edit</AppButton>
            <AppButton variant="danger" @click="confirmingCancel = true">Cancel Session</AppButton>
          </div>

          <div v-else class="rounded-md bg-red-50 border border-red-200 p-3 flex flex-col gap-2">
            <p class="text-sm text-red-700 font-medium">Cancel this session?</p>
            <p class="text-xs text-red-600">Students confirmed for this session will be notified (future phase).</p>
            <p v-if="cancelError" role="alert" class="text-xs text-red-700">{{ cancelError }}</p>
            <div class="flex gap-2">
              <AppButton variant="danger" :disabled="cancelling" @click="confirmCancel">
                {{ cancelling ? 'Cancelling…' : 'Yes, cancel it' }}
              </AppButton>
              <AppButton variant="secondary" @click="confirmingCancel = false">Keep</AppButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Session not found.</div>
  </div>
</template>
