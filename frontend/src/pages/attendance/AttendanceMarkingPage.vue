<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAttendanceStore } from '@/stores/attendanceStore'
import { useToastStore } from '@/stores/toastStore'
import { toHHMM, formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const attendanceStore = useAttendanceStore()
const toastStore = useToastStore()

const sessionId = route.params.id as string
const saving = ref(false)

// Local mutable copy of checkboxes keyed by studentId
const localState = reactive<Record<string, { present: boolean; paidCash: boolean }>>({})

const rosterData = computed(() => attendanceStore.rosterBySession[sessionId])
const session = computed(() => rosterData.value?.session)
const roster = computed(() => rosterData.value?.roster ?? [])

function initLocalState() {
  for (const entry of roster.value) {
    localState[entry.student.id] = {
      present: entry.present,
      paidCash: entry.paidCash,
    }
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
        <h1 class="text-lg font-semibold text-gray-900">Mark Attendance</h1>
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

      <!-- Empty roster -->
      <div v-else-if="roster.length === 0" class="text-center py-10 text-gray-400 text-sm">
        No active students found.
      </div>

      <!-- Roster list -->
      <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <!-- Header row -->
        <div class="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>Student</span>
          <span class="text-center w-16">Pre-att.</span>
          <span class="text-center w-16">Present</span>
          <span class="text-center w-16">Paid</span>
        </div>

        <!-- Rows -->
        <div
          v-for="entry in roster"
          :key="entry.student.id"
          class="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-3 border-b border-gray-100 last:border-0"
        >
          <span class="text-sm text-gray-900 truncate">{{ entry.student.name }}</span>

          <!-- Pre-attended indicator -->
          <span class="w-16 flex justify-center">
            <span
              class="inline-block h-2 w-2 rounded-full"
              :class="entry.preAttended ? 'bg-green-500' : 'bg-gray-200'"
              :title="entry.preAttended ? 'Pre-attended' : 'Not pre-attended'"
            />
          </span>

          <!-- Present checkbox -->
          <label class="w-16 flex justify-center cursor-pointer">
            <input
              v-if="localState[entry.student.id]"
              v-model="localState[entry.student.id].present"
              type="checkbox"
              :disabled="session.isCancelled"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <!-- Paid cash checkbox -->
          <label class="w-16 flex justify-center cursor-pointer">
            <input
              v-if="localState[entry.student.id]"
              v-model="localState[entry.student.id].paidCash"
              type="checkbox"
              :disabled="session.isCancelled"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      <!-- Save button -->
      <div v-if="!session.isCancelled && roster.length > 0" class="mt-4 flex gap-3">
        <AppButton :disabled="saving" @click="handleSave">
          {{ saving ? 'Saving…' : 'Save Attendance' }}
        </AppButton>
      </div>
    </template>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Session not found.</div>
  </div>
</template>
