<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { timeAgo } from '@/utils/format'
import type { Notification } from '@/api/notifications'
import type { IconName } from '@/utils/icons'

export interface NavLink {
  label: string
  to: string
  exact?: boolean
  icon?: IconName
}

const props = defineProps<{ links: NavLink[] }>()
const emit = defineEmits<{ logout: [] }>()

const router = useRouter()
const notifStore = useNotificationStore()

const dashboardLink = computed(
  () => props.links.find((l) => l.label === 'Dashboard')?.to ?? '/',
)

const menuOpen = ref(false)
const mobileNav = ref<HTMLElement | null>(null)

const bellOpen = ref(false)
const bellRef = ref<HTMLElement | null>(null)

onClickOutside(mobileNav, () => { menuOpen.value = false })
onClickOutside(bellRef, () => { bellOpen.value = false })

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    menuOpen.value = false
    bellOpen.value = false
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

function closeAndLogout() {
  menuOpen.value = false
  emit('logout')
}

async function toggleBell() {
  bellOpen.value = !bellOpen.value
  if (bellOpen.value) {
    menuOpen.value = false
    await notifStore.fetchNotifications({ limit: 10 })
  }
}

async function handleMarkAllRead() {
  await notifStore.markAllRead()
}

function goToNotifications() {
  bellOpen.value = false
  router.push('/notifications')
}

function handleNotifClick(n: Notification) {
  if (!n.readAt) notifStore.markRead(n.id)
  bellOpen.value = false
  if (n.linkPath) router.push(n.linkPath)
}
</script>

<template>
  <header class="bg-white border-b border-gray-200 shadow-sm">
    <div class="flex items-center justify-between px-4 py-3">
      <!-- Logo — click returns to role dashboard -->
      <RouterLink :to="dashboardLink" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <img src="@/assets/logo-transparent.png" alt="STF Supreme Chess" class="h-8 w-auto" />
        <span class="font-semibold text-gray-900 text-sm">STF Supreme Chess</span>
      </RouterLink>

      <!-- Right side: desktop nav + bell + mobile burger -->
      <div class="flex items-center gap-2">
        <!-- Desktop nav -->
        <nav class="hidden sm:flex items-center gap-4 text-sm" aria-label="Main navigation">
          <RouterLink
            v-for="link in props.links"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-1 text-gray-600 hover:text-indigo-600 transition-colors"
            :active-class="link.exact ? '' : 'text-indigo-600 font-medium'"
            exact-active-class="text-indigo-600 font-medium"
          >
            <AppIcon v-if="link.icon" :name="link.icon" class="h-4 w-4" />
            {{ link.label }}
          </RouterLink>
          <button class="flex items-center gap-1 text-gray-600 hover:text-gray-900" @click="emit('logout')">
            <AppIcon name="logout" class="h-4 w-4" />
            Logout
          </button>
        </nav>

        <!-- Bell button (always visible) -->
        <div ref="bellRef" class="relative">
          <button
            class="relative p-1.5 rounded text-gray-600 hover:text-indigo-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Notifications"
            @click="toggleBell"
          >
            <AppIcon name="bell" class="h-5 w-5" />
            <span
              v-if="notifStore.unreadCount > 0"
              class="absolute top-0.5 right-0.5 min-w-[1rem] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold leading-4 rounded-full flex items-center justify-center"
            >
              {{ notifStore.unreadCount > 99 ? '99+' : notifStore.unreadCount }}
            </span>
          </button>

          <!-- Bell dropdown -->
          <Transition name="menu">
            <div
              v-if="bellOpen"
              class="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-100 z-50 flex flex-col"
            >
              <!-- Header -->
              <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <span class="text-sm font-semibold text-gray-900">Notifications</span>
                <button
                  v-if="notifStore.unreadCount > 0"
                  class="text-xs text-indigo-600 hover:underline"
                  @click="handleMarkAllRead"
                >
                  Mark all read
                </button>
              </div>

              <!-- Loading -->
              <div v-if="notifStore.loading" class="py-6 text-center text-xs text-gray-400">
                Loading…
              </div>

              <!-- Empty -->
              <div v-else-if="notifStore.items.length === 0" class="py-6 text-center text-xs text-gray-400">
                No notifications yet.
              </div>

              <!-- List -->
              <ul v-else class="max-h-80 overflow-y-auto divide-y divide-gray-50">
                <li
                  v-for="n in notifStore.items"
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

              <!-- Footer -->
              <div class="border-t border-gray-100 px-4 py-2.5">
                <button
                  class="w-full text-xs text-indigo-600 hover:underline text-center"
                  @click="goToNotifications"
                >
                  See all notifications →
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Mobile burger + dropdown -->
        <div ref="mobileNav" class="relative sm:hidden">
          <button
            class="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Menu"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <svg v-if="!menuOpen" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Mobile dropdown -->
          <Transition name="menu">
            <nav
              v-if="menuOpen"
              role="menu"
              aria-label="Main navigation"
              class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-md border border-gray-100 z-40 py-1"
            >
              <RouterLink
                v-for="link in props.links"
                :key="link.to"
                :to="link.to"
                role="menuitem"
                class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                :active-class="link.exact ? '' : 'text-indigo-600 font-medium bg-indigo-50'"
                exact-active-class="text-indigo-600 font-medium bg-indigo-50"
                @click="menuOpen = false"
              >
                <AppIcon v-if="link.icon" :name="link.icon" class="h-4 w-4" />
                {{ link.label }}
              </RouterLink>
              <button
                role="menuitem"
                class="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                @click="closeAndLogout"
              >
                <AppIcon name="logout" class="h-4 w-4" />
                Logout
              </button>
            </nav>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
</style>
