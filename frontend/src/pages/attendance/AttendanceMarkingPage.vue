<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAttendanceStore } from '@/stores/attendanceStore'
import { useToastStore } from '@/stores/toastStore'
import { setPreAttendance } from '@/api/attendance'
import { toHHMM, formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const attendanceStore = useAttendanceStore()
const toastStore = useToastStore()

const sessionId = route.params.id as string
const saving = ref(false)

// Local mutable copy of checkboxes keyed by studentId
const localState = reactive<Record<string, { present: boolean; paidCash: boolean; preAttended: boolean }>>({})

const rosterData = computed(() => attendanceStore.rosterBySession[sessionId])
const session = computed(() => rosterData.value?.session)
const allRoster = computed(() => rosterData.value?.roster ?? [])

const searchQuery = ref('')
const roster = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allRoster.value
  return allRoster.value.filter((e) => e.student.name.toLowerCase().includes(q))
})

function initLocalState() {
  for (const entry of allRoster.value) {
    localState[entry.student.id] = {
      present: entry.present,
      // Force-uncheck cash if student already has an approved online payment
      paidCash: entry.onlinePaymentStatus === 'approved' ? false : entry.paidCash,
      preAttended: entry.preAttended,
    }
  }
}

async function handlePreAttendanceToggle(studentId: string, confirmed: boolean) {
  const old = localState[studentId].preAttended
  localState[studentId].preAttended = confirmed
  try {
    await setPreAttendance(sessionId, confirmed, studentId)
  } catch {
    localState[studentId].preAttended = old
    toastStore.show('Failed to update pre-attendance.', 'error')
  }
}

async function handleSave() {
  saving.value = true
  try {
    const entries = Object.entries(localState).map(([studentId, state]) => ({
      studentId,
      present: state.present,
      paidCash: state.paidCash,
    }))
    const result = await attendanceStore.saveRoster(sessionId, entries)
    toastStore.show(`Saved — ${result.updated} record(s) updated.`, 'success')
  } catch {
    toastStore.show('Failed to save. Your changes are kept — try again.', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await attendanceStore.fetchRoster(sessionId)
  initLocalState()
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push(`/sessions/${sessionId}`)"
    >
      ← Back to session
    </button>

    <div v-if="attendanceStore.loading && !rosterData" class="text-center py-10 text-gray-400 text-sm">
      Loading roster…
    </div>

    <template v-else-if="session">
      <!-- Session info header -->
      <div class="mb-4">
        <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
          <AppIcon name="clipboard" class="h-5 w-5 text-indigo-600" />
          Mark Attendance
        </h1>
        <p class="text-sm text-gray-600 mt-0.5">
          {{ formatDate(session.date) }} · {{ toHHMM(session.startTime) }}–{{ toHHMM(session.endTime) }} · {{ session.place }}
        </p>
      </div>

      <!-- Cancelled banner -->
      <div
        v-if="session.isCancelled"
        class="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4"
      >
        This session is cancelled — attendance marking is disabled.
      </div>

      <!-- Search (not cancelled + students exist) -->
      <div v-if="!session.isCancelled && allRoster.length > 0" class="relative mb-3">
        <AppIcon name="search" class="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search by name…"
          class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 pl-8"
        />
      </div>

      <!-- Empty: no students at all -->
      <div v-if="!session.isCancelled && allRoster.length === 0" class="text-center py-10 text-gray-400 text-sm">
        No active students found.
      </div>

      <!-- Empty: no search match -->
      <div v-else-if="!session.isCancelled && allRoster.length > 0 && roster.length === 0" class="text-center py-10 text-gray-400 text-sm">
        No students match your search.
      </div>

      <!-- Roster list -->
      <div v-if="!session.isCancelled && roster.length > 0" class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <!-- Header row — desktop only -->
        <div class="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>Student</span>
          <span class="text-center w-12">Pre-att.</span>
          <span class="text-center w-14">Present</span>
          <span class="text-center w-12">Cash</span>
          <span class="text-center w-20">Online</span>
        </div>

        <div
          v-for="entry in roster"
          :key="entry.student.id"
          class="border-b border-gray-100 last:border-0"
        >
          <!-- ── Mobile card (<sm) ── -->
          <div class="sm:hidden px-4 py-3 flex flex-col gap-y-2">
            <!-- Line 1: name -->
            <span class="text-sm font-medium text-gray-900 truncate">{{ entry.student.name }}</span>

            <!-- Line 2: ATTENDANCE section label + Pre-att + Present checkboxes -->
            <div class="flex items-center gap-3 flex-wrap">
              <span class="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">Attendance</span>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input
                  v-if="localState[entry.student.id]"
                  type="checkbox"
                  :checked="localState[entry.student.id].preAttended"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  @change="(e) => handlePreAttendanceToggle(entry.student.id, (e.target as HTMLInputElement).checked)"
                />
                <span class="text-xs text-gray-600">Pre-att.</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input
                  v-if="localState[entry.student.id]"
                  v-model="localState[entry.student.id].present"
                  type="checkbox"
                  :disabled="session.isCancelled"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span class="text-xs text-gray-600">Present</span>
              </label>
            </div>

            <!-- Line 3: PAYMENT section label + Cash checkbox + Online status -->
            <div class="flex items-center gap-3 flex-wrap">
              <span class="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">Payment</span>
              <label
                class="flex items-center gap-1.5"
                :class="entry.onlinePaymentStatus !== 'approved' ? 'cursor-pointer' : 'cursor-not-allowed'"
                :title="entry.onlinePaymentStatus === 'approved' ? 'Student already paid online' : undefined"
              >
                <input
                  v-if="localState[entry.student.id]"
                  v-model="localState[entry.student.id].paidCash"
                  type="checkbox"
                  :disabled="session.isCancelled || entry.onlinePaymentStatus === 'approved'"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                />
                <span class="text-xs text-gray-600">Cash</span>
              </label>
              <span class="text-gray-300 text-xs">·</span>
              <span class="text-xs text-gray-400">Online:</span>
              <span
                v-if="entry.onlinePaymentStatus === 'approved'"
                class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium whitespace-nowrap"
              >Paid ✓</span>
              <span
                v-else-if="entry.onlinePaymentStatus === 'pending'"
                class="inline-block rounded-full bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 font-medium"
              >Pending</span>
              <span
                v-else-if="entry.onlinePaymentStatus === 'rejected'"
                class="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium"
              >Rejected</span>
              <span v-else class="text-xs text-gray-300">—</span>
            </div>
          </div>

          <!-- ── Desktop grid row (≥sm) ── -->
          <div class="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-2 px-4 py-3 items-center">
            <span class="text-sm font-medium text-gray-900 truncate">{{ entry.student.name }}</span>
            <label class="w-12 flex justify-center cursor-pointer">
              <input
                v-if="localState[entry.student.id]"
                type="checkbox"
                :checked="localState[entry.student.id].preAttended"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                @change="(e) => handlePreAttendanceToggle(entry.student.id, (e.target as HTMLInputElement).checked)"
              />
            </label>
            <label class="w-14 flex justify-center cursor-pointer">
              <input
                v-if="localState[entry.student.id]"
                v-model="localState[entry.student.id].present"
                type="checkbox"
                :disabled="session.isCancelled"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
            <label
              class="w-12 flex justify-center"
              :class="entry.onlinePaymentStatus !== 'approved' ? 'cursor-pointer' : 'cursor-not-allowed'"
              :title="entry.onlinePaymentStatus === 'approved' ? 'Student already paid online' : undefined"
            >
              <input
                v-if="localState[entry.student.id]"
                v-model="localState[entry.student.id].paidCash"
                type="checkbox"
                :disabled="session.isCancelled || entry.onlinePaymentStatus === 'approved'"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
              />
            </label>
            <div class="w-20 flex justify-center">
              <span
                v-if="entry.onlinePaymentStatus === 'approved'"
                class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium whitespace-nowrap"
              >Paid ✓</span>
              <span
                v-else-if="entry.onlinePaymentStatus === 'pending'"
                class="inline-block rounded-full bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 font-medium"
              >Pending</span>
              <span
                v-else-if="entry.onlinePaymentStatus === 'rejected'"
                class="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium"
              >Rejected</span>
              <span v-else class="text-gray-300 text-sm">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div v-if="!session.isCancelled && allRoster.length > 0" class="mt-4 flex gap-3">
        <AppButton :disabled="saving" @click="handleSave">
          <AppIcon v-if="!saving" name="check" class="h-4 w-4" />
          {{ saving ? 'Saving…' : 'Save Attendance' }}
        </AppButton>
      </div>
    </template>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Session not found.</div>
  </div>
</template>
