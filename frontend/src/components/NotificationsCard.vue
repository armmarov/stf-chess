<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { timeAgo } from '@/utils/format'
import AppIcon from '@/components/AppIcon.vue'
import type { Notification } from '@/api/notifications'

const notifStore = useNotificationStore()
const router = useRouter()

const latest = computed(() => notifStore.items.slice(0, 5))

onMounted(() => {
  if (!notifStore.lastFetchedAt) {
    notifStore.fetchNotifications({ limit: 5 })
  }
})

function handleNotifClick(n: Notification) {
  if (!n.readAt) notifStore.markRead(n.id)
  if (n.linkPath) router.push(n.linkPath)
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <h2 class="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="bell" class="h-4 w-4 text-indigo-500" />
        Notifications
        <span
          v-if="notifStore.unreadCount > 0"
          class="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold"
        >
          {{ notifStore.unreadCount }}
        </span>
      </h2>
      <button
        class="text-xs text-indigo-600 hover:underline"
        @click="router.push('/notifications')"
      >
        See all
      </button>
    </div>

    <!-- Loading -->
    <div v-if="notifStore.loading" class="px-4 py-6 text-center text-xs text-gray-400">
      Loading…
    </div>

    <!-- Empty -->
    <div v-else-if="latest.length === 0" class="px-4 py-6 text-center text-xs text-gray-400">
      No notifications yet.
    </div>

    <!-- List -->
    <ul v-else class="divide-y divide-gray-50">
      <li
        v-for="n in latest"
        :key="n.id"
        class="flex gap-3 px-4 py-3 cursor-pointer transition-colors"
        :class="!n.readAt ? 'bg-indigo-50/40 hover:bg-indigo-100/60' : 'hover:bg-gray-50'"
        @click="handleNotifClick(n)"
      >
        <span
          class="mt-1 h-2 w-2 shrink-0 rounded-full"
          :class="!n.readAt ? 'bg-indigo-500' : 'bg-gray-200'"
        />
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-gray-900 truncate">{{ n.title }}</p>
          <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ n.message }}</p>
        </div>
        <span class="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{{ timeAgo(n.createdAt) }}</span>
      </li>
    </ul>
  </div>
</template>
