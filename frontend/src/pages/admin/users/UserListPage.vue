<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import type { Role } from '@/stores/authStore'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppWhatsAppLink from '@/components/AppWhatsAppLink.vue'

const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()

type RoleTab = 'all' | Role
const tabs: { label: string; value: RoleTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Students', value: 'student' },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Coaches', value: 'coach' },
  { label: 'Admins', value: 'admin' },
]

const activeTab = ref<RoleTab>('all')
const showInactive = ref(false)

const query = computed(() => ({
  role: activeTab.value === 'all' ? undefined : activeTab.value,
  active: showInactive.value ? undefined : true,
}))

const cacheKey = computed(() => userStore.cacheKey(query.value))
const users = computed(() => userStore.listCache[cacheKey.value] ?? [])

async function load() {
  try {
    await userStore.fetchUsers(query.value)
  } catch {
    toastStore.show('Failed to load users.', 'error')
  }
}

watch([activeTab, showInactive], load)
onMounted(load)

const roleBadge: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-700',
  teacher: 'bg-blue-100 text-blue-700',
  coach: 'bg-yellow-100 text-yellow-700',
  student: 'bg-green-100 text-green-700',
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="users" class="h-5 w-5 text-indigo-600" />
        Users
      </h1>
      <AppButton @click="router.push('/admin/users/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New User
      </AppButton>
    </div>

    <!-- Role tabs -->
    <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3 overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="flex-1 min-w-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
        :class="
          activeTab === tab.value
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        "
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Inactive toggle -->
    <label class="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer select-none">
      <input
        v-model="showInactive"
        type="checkbox"
        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      Show inactive users
    </label>

    <!-- Loading -->
    <div v-if="userStore.loading" class="text-center py-10 text-gray-400 text-sm">
      Loading users…
    </div>

    <!-- Empty -->
    <div v-else-if="users.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No users found.
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="user in users"
        :key="user.id"
        class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors"
        @click="router.push(`/admin/users/${user.id}`)"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-900 text-sm truncate">{{ user.name }}</p>
            <p class="text-xs text-gray-500 mt-0.5 truncate">@{{ user.username }}</p>
            <p v-if="user.className" class="text-xs text-gray-400 mt-0.5 truncate">{{ user.className }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="inline-block rounded-full text-xs px-2 py-0.5 font-medium capitalize"
              :class="roleBadge[user.role]"
            >
              {{ user.role }}
            </span>
            <span
              class="inline-block rounded-full text-xs px-2 py-0.5 font-medium"
              :class="user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
            >
              {{ user.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
        <p v-if="user.phone" class="text-xs mt-1">
          <AppWhatsAppLink :phone="user.phone" />
        </p>
      </div>
    </div>
  </div>
</template>
