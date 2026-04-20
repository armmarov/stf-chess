<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useToastStore } from '@/stores/toastStore'
import { timeAgo } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Notification } from '@/api/notifications'

const notifStore = useNotificationStore()
const toastStore = useToastStore()
const router = useRouter()

onMounted(() => notifStore.fetchNotifications({ limit: 50 }))

async function handleMarkAllRead() {
  try {
    await notifStore.markAllRead()
    toastStore.show('All notifications marked as read.', 'success')
  } catch {
    toastStore.show('Failed to mark notifications as read.', 'error')
  }
}

function handleNotifClick(n: Notification) {
  if (!n.readAt) notifStore.markRead(n.id)
  if (n.linkPath) router.push(n.linkPath)
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="bell" class="h-5 w-5 text-indigo-600" />
        Notifications
      </h1>
      <AppButton
        v-if="notifStore.unreadCount > 0"
        variant="secondary"
        @click="handleMarkAllRead"
      >
        Mark all read
      </AppButton>
    </div>

    <!-- Loading -->
    <div v-if="notifStore.loading && notifStore.items.length === 0" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <!-- Empty -->
    <div v-else-if="notifStore.items.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No notifications yet.
    </div>

    <!-- List -->
    <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <ul class="divide-y divide-gray-100">
        <li
          v-for="n in notifStore.items"
          :key="n.id"
          class="flex gap-3 px-4 py-3 cursor-pointer transition-colors"
          :class="!n.readAt ? 'bg-indigo-50/40 hover:bg-indigo-100/60' : 'hover:bg-gray-50'"
          @click="handleNotifClick(n)"
        >
          <span
            class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            :class="!n.readAt ? 'bg-indigo-500' : 'bg-gray-200'"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900">{{ n.title }}</p>
            <p class="text-sm text-gray-600 mt-0.5">{{ n.message }}</p>
          </div>
          <span class="text-xs text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{{ timeAgo(n.createdAt) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
