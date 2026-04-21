<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordStore } from '@/stores/recordStore'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { placementLabel, LEVEL_LABELS, CATEGORY_LABELS } from '@/utils/records'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const recordStore = useRecordStore()
const auth = useAuthStore()
const userStore = useUserStore()
const router = useRouter()

const selectedStudentId = ref<string>('')

const canCreate = computed(() => {
  const role = auth.user?.role
  return role === 'admin' || role === 'teacher' || role === 'student'
})

const students = computed(() => userStore.listCache[userStore.cacheKey({ role: 'student' })] ?? [])

const canEditRecord = (record: { createdBy?: { id: string } | null } | undefined) => {
  if (!record) return false
  const role = auth.user?.role
  if (role === 'admin' || role === 'teacher') return true
  return record.createdBy?.id === auth.user?.id
}

function formatCompetitionDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function levelColorClass(level: string): string {
  const map: Record<string, string> = {
    sekolah: 'bg-gray-100 text-gray-700',
    daerah: 'bg-blue-100 text-blue-700',
    negeri: 'bg-purple-100 text-purple-700',
    kebangsaan: 'bg-orange-100 text-orange-700',
    antarabangsa: 'bg-red-100 text-red-700',
  }
  return map[level] ?? 'bg-gray-100 text-gray-700'
}

function placementColorClass(p: number | null): string {
  if (p === 1) return 'bg-yellow-100 text-yellow-800 font-semibold'
  if (p === 2) return 'bg-slate-100 text-slate-700 font-semibold'
  if (p === 3) return 'bg-amber-100 text-amber-700 font-semibold'
  return 'bg-indigo-50 text-indigo-700'
}

async function loadList() {
  const filter = selectedStudentId.value ? { studentId: selectedStudentId.value } : undefined
  await recordStore.fetchList(filter)
}

watch(selectedStudentId, loadList)

onMounted(async () => {
  const tasks: Promise<unknown>[] = [loadList()]
  // Only admin / teacher may list users; students get 403.
  if (auth.user?.role === 'admin' || auth.user?.role === 'teacher') {
    tasks.push(userStore.fetchUsers({ role: 'student' }))
  }
  await Promise.all(tasks)
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="award" class="h-5 w-5 text-indigo-600" />
        Competition Records
      </h1>
      <AppButton v-if="canCreate" @click="router.push('/records/new')">
        <AppIcon name="plus" class="h-4 w-4 mr-1" />
        New record
      </AppButton>
    </div>

    <!-- Student filter (not shown to students — they only have their own) -->
    <div v-if="auth.user?.role !== 'student'" class="mb-4">
      <label class="text-sm font-medium text-gray-700 block mb-1">Filter by student</label>
      <select
        v-model="selectedStudentId"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        <option value="">All students</option>
        <option v-for="s in students" :key="s.id" :value="s.id">
          {{ s.name }}{{ s.className ? ` (${s.className})` : '' }}
        </option>
      </select>
    </div>

    <div v-if="recordStore.loading && recordStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="!recordStore.loading && recordStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No records found.
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="record in recordStore.list"
        :key="record.id"
        class="bg-white rounded-lg border border-gray-200 p-4 transition-colors"
        :class="canEditRecord(record) ? 'cursor-pointer hover:border-indigo-300' : ''"
        @click="canEditRecord(record) ? router.push(`/records/${record.id}/edit`) : undefined"
      >
        <!-- Top row: student name + className badge -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-sm text-gray-900">{{ record.student.name }}</span>
            <span
              v-if="record.student.className"
              class="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5"
            >
              {{ record.student.className }}
            </span>
          </div>
          <span
            class="shrink-0 text-xs rounded-full px-2 py-0.5"
            :class="placementColorClass(record.placement)"
          >
            {{ placementLabel(record.placement) }}
          </span>
        </div>

        <!-- Competition name + date -->
        <p class="text-sm text-gray-800 font-medium mb-1.5">{{ record.competitionName }}</p>
        <p class="text-xs text-gray-500 mb-2 flex items-center gap-1">
          <AppIcon name="calendar" class="h-3 w-3 text-gray-400 shrink-0" />
          {{ formatCompetitionDate(record.competitionDate) }}
        </p>

        <!-- Badges row -->
        <div class="flex flex-wrap gap-1.5 items-center">
          <span
            class="text-xs rounded-full px-2 py-0.5"
            :class="levelColorClass(record.level)"
          >
            {{ LEVEL_LABELS[record.level] }}
          </span>
          <span class="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
            {{ CATEGORY_LABELS[record.category] }}
          </span>

          <!-- Conditional rating pills -->
          <span v-if="record.pajsk" class="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">
            PAJSK
          </span>
          <span v-if="record.fideRated" class="text-xs bg-sky-100 text-sky-700 rounded-full px-2 py-0.5">
            FIDE
          </span>
          <span v-if="record.mcfRated" class="text-xs bg-teal-100 text-teal-700 rounded-full px-2 py-0.5">
            MCF
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
