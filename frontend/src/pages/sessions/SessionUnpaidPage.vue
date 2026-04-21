<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAttendanceStore } from '@/stores/attendanceStore'
import { formatDate, toHHMM } from '@/utils/format'
import AppIcon from '@/components/AppIcon.vue'
import AppWhatsAppLink from '@/components/AppWhatsAppLink.vue'

const route = useRoute()
const router = useRouter()
const attendanceStore = useAttendanceStore()

const id = route.params.id as string

const rosterData = computed(() => attendanceStore.rosterBySession[id])
const session = computed(() => rosterData.value?.session)

const unpaidStudents = computed(() =>
  (rosterData.value?.roster ?? []).filter(
    (entry) =>
      entry.present &&
      !entry.paidCash &&
      entry.onlinePaymentStatus !== 'approved',
  ),
)

onMounted(() => attendanceStore.fetchRoster(id))
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push(`/sessions/${id}`)"
    >
      ← Back to session
    </button>

    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="dollar" class="h-5 w-5 text-red-500" />
      Unpaid Students
    </h1>

    <!-- Session header -->
    <div v-if="session" class="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <p class="text-sm font-medium text-gray-900">
        {{ formatDate(session.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
      </p>
      <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
        <AppIcon name="clock" class="h-3.5 w-3.5 shrink-0" />
        {{ toHHMM(session.startTime) }} – {{ toHHMM(session.endTime) }}
        <span class="mx-1">·</span>
        <AppIcon name="map-pin" class="h-3.5 w-3.5 shrink-0" />
        {{ session.place }}
      </p>
    </div>

    <div v-if="attendanceStore.loading && !rosterData" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <template v-else>
      <div v-if="unpaidStudents.length === 0" class="text-center py-10 text-gray-400 text-sm">
        All present students have paid.
      </div>

      <div v-else class="flex flex-col gap-3">
        <p class="text-xs text-gray-500">{{ unpaidStudents.length }} student{{ unpaidStudents.length !== 1 ? 's' : '' }} still unpaid</p>

        <div
          v-for="entry in unpaidStudents"
          :key="entry.student.id"
          class="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-3"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ entry.student.name }}</p>
            <AppWhatsAppLink :phone="entry.student.phone" class="text-xs mt-0.5" />
          </div>
          <span
            v-if="entry.student.className"
            class="inline-block rounded-full bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 font-medium shrink-0"
          >
            {{ entry.student.className }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
