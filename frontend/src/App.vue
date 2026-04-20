<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import AppToast from '@/components/AppToast.vue'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

const auth = useAuthStore()
const notifStore = useNotificationStore()

let pollInterval: ReturnType<typeof setInterval> | null = null

function onFocus() {
  notifStore.fetchUnreadCount()
}

function startPolling() {
  notifStore.fetchUnreadCount()
  pollInterval = setInterval(() => notifStore.fetchUnreadCount(), 60_000)
  window.addEventListener('focus', onFocus)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  window.removeEventListener('focus', onFocus)
}

watch(
  () => auth.user,
  (user) => {
    if (user) startPolling()
    else stopPolling()
  },
  { immediate: true },
)

onUnmounted(() => stopPolling())
</script>

<template>
  <RouterView />
  <AppToast />
  <AppConfirmDialog />
</template>
