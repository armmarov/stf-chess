<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppWhatsAppLink from '@/components/AppWhatsAppLink.vue'

const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()
const { confirm } = useConfirm()

const showInactive = ref(false)

const query = computed(() => ({
  role: 'student' as const,
  active: showInactive.value ? undefined : true,
}))

const searchQuery = ref('')

const cacheKey = computed(() => userStore.cacheKey(query.value))
const allStudents = computed(() => userStore.listCache[cacheKey.value] ?? [])
const students = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allStudents.value
  return allStudents.value.filter((s) => s.name.toLowerCase().includes(q))
})

const togglingId = ref<string | null>(null)

async function load() {
  try {
    await userStore.fetchUsers(query.value)
  } catch {
    toastStore.show('Failed to load students.', 'error')
  }
}

onMounted(load)

async function toggleActive(id: string, currentActive: boolean) {
  if (currentActive) {
    const ok = await confirm({
      title: 'Deactivate student?',
      message: "They won't be able to log in until reactivated.",
      confirmLabel: 'Deactivate',
      variant: 'danger',
    })
    if (!ok) return
  }
  togglingId.value = id
  try {
    await userStore.updateUser(id, { isActive: !currentActive })
    toastStore.show(currentActive ? 'Student deactivated.' : 'Student reactivated.', 'success')
    await load()
  } catch {
    toastStore.show('Failed to update student status.', 'error')
  } finally {
    togglingId.value = null
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="users" class="h-5 w-5 text-indigo-600" />
        Students
      </h1>
      <AppButton @click="router.push('/teacher/students/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New Student
      </AppButton>
    </div>

    <!-- Search -->
    <div class="relative mb-3">
      <AppIcon name="search" class="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search by name…"
        class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 pl-8"
      />
    </div>

    <!-- Inactive toggle -->
    <label class="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer select-none">
      <input
        v-model="showInactive"
        type="checkbox"
        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        @change="load"
      />
      Show inactive students
    </label>

    <!-- Loading -->
    <div v-if="userStore.loading" class="text-center py-10 text-gray-400 text-sm">
      Loading students…
    </div>

    <!-- Empty -->
    <div v-else-if="students.length === 0" class="text-center py-10 text-gray-400 text-sm">
      {{ searchQuery.trim() ? 'No students match your search.' : 'No students found.' }}
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="student in students"
        :key="student.id"
        class="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-medium text-gray-900 text-sm truncate">{{ student.name }}</p>
          <p class="text-xs text-gray-500 mt-0.5 truncate">@{{ student.username }}</p>
          <p v-if="student.className" class="text-xs text-gray-400 mt-0.5 truncate">{{ student.className }}</p>
          <span v-if="student.phone" class="text-xs mt-0.5">
            <AppWhatsAppLink :phone="student.phone" />
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <span
            class="inline-block rounded-full text-xs px-2 py-0.5 font-medium"
            :class="student.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ student.isActive ? 'Active' : 'Inactive' }}
          </span>
          <AppButton
            variant="secondary"
            @click="router.push(`/teacher/students/${student.id}/edit`)"
          >
            <AppIcon name="edit" class="h-4 w-4" />
            Edit
          </AppButton>
          <AppButton
            :variant="student.isActive ? 'danger' : 'secondary'"
            :disabled="togglingId === student.id"
            @click="toggleActive(student.id, student.isActive)"
          >
            <template v-if="togglingId !== student.id">
              <AppIcon :name="student.isActive ? 'user-minus' : 'user'" class="h-4 w-4" />
            </template>
            {{ togglingId === student.id ? '…' : student.isActive ? 'Deactivate' : 'Reactivate' }}
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
