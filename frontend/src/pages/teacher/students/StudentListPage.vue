<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppWhatsAppLink from '@/components/AppWhatsAppLink.vue'

const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()

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

async function load() {
  try {
    await userStore.fetchUsers(query.value)
  } catch {
    toastStore.show('Failed to load students.', 'error')
  }
}

watch(showInactive, load)
onMounted(load)
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
        class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors"
        @click="router.push(`/teacher/students/${student.id}`)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 text-sm truncate">{{ student.name }}</p>
            <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
              <AppIcon name="hash" class="h-3 w-3 shrink-0 text-gray-400" />
              @{{ student.username }}
            </p>
            <span v-if="student.phone" class="text-xs mt-0.5 inline-block" @click.stop>
              <AppWhatsAppLink :phone="student.phone" />
            </span>
          </div>
          <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span
              v-if="student.className"
              class="inline-block rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5 font-medium"
            >
              {{ student.className }}
            </span>
            <span
              class="inline-block rounded-full text-xs px-2 py-0.5 font-medium"
              :class="student.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
            >
              {{ student.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
