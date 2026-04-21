<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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

export interface NavGroup {
  label: string
  icon?: IconName
  children: NavLink[]
}

export type NavItem = NavLink | NavGroup

function isGroup(item: NavItem): item is NavGroup {
  return (item as NavGroup).children !== undefined
}

// Back-compat: accept either `items` (new) or `links` (old flat list).
const props = defineProps<{ items?: NavItem[]; links?: NavLink[] }>()
const emit = defineEmits<{ logout: [] }>()

const router = useRouter()
const route = useRoute()
const notifStore = useNotificationStore()

const navItems = computed<NavItem[]>(() => props.items ?? props.links ?? [])

const dashboardLink = computed(() => {
  for (const it of navItems.value) {
    if (!isGroup(it) && it.label === 'Dashboard') return it.to
  }
  return '/'
})

function groupIsActive(g: NavGroup): boolean {
  return g.children.some((c) => route.path === c.to || route.path.startsWith(c.to + '/'))
}

const openGroup = ref<string | null>(null)
const desktopNavRef = ref<HTMLElement | null>(null)
onClickOutside(desktopNavRef, () => { openGroup.value = null })

function toggleGroup(label: string) {
  openGroup.value = openGroup.value === label ? null : label
}

const menuOpen = ref(false)
const mobileNav = ref<HTMLElement | null>(null)
const mobileOpenSections = ref<Set<string>>(new Set())

function toggleMobileSection(label: string) {
  const next = new Set(mobileOpenSections.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  mobileOpenSections.value = next
}

const bellOpen = ref(false)
const bellRef = ref<HTMLElement | null>(null)

onClickOutside(mobileNav, () => { menuOpen.value = false })
onClickOutside(bellRef, () => { bellOpen.value = false })

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    menuOpen.value = false
    bellOpen.value = false
    openGroup.value = null
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

function closeAllAndLogout() {
  menuOpen.value = false
  openGroup.value = null
  emit('logout')
}

async function toggleBell() {
  bellOpen.value = !bellOpen.value
  if (bellOpen.value) {
    menuOpen.value = false
    openGroup.value = null
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
        <nav
          ref="desktopNavRef"
          class="hidden sm:flex items-center gap-4 text-sm"
          aria-label="Main navigation"
        >
          <template v-for="item in navItems" :key="item.label">
            <!-- Top-level link -->
            <RouterLink
              v-if="!isGroup(item)"
              :to="item.to"
              class="flex items-center gap-1 text-gray-600 hover:text-indigo-600 transition-colors"
              :active-class="item.exact ? '' : 'text-indigo-600 font-medium'"
              exact-active-class="text-indigo-600 font-medium"
            >
              <AppIcon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
              {{ item.label }}
            </RouterLink>

            <!-- Top-level group with dropdown -->
            <div v-else class="relative">
              <button
                type="button"
                class="flex items-center gap-1 text-gray-600 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-0.5"
                :class="{ 'text-indigo-600 font-medium': groupIsActive(item) }"
                :aria-expanded="openGroup === item.label"
                aria-haspopup="true"
                @click="toggleGroup(item.label)"
              >
                <AppIcon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
                {{ item.label }}
                <svg
                  class="h-3 w-3 transition-transform"
                  :class="{ 'rotate-180': openGroup === item.label }"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <Transition name="menu">
                <div
                  v-if="openGroup === item.label"
                  class="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-md border border-gray-100 z-40 py-1"
                  role="menu"
                >
                  <RouterLink
                    v-for="child in item.children"
                    :key="child.to"
                    :to="child.to"
                    role="menuitem"
                    class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                    :active-class="child.exact ? '' : 'text-indigo-600 font-medium bg-indigo-50'"
                    exact-active-class="text-indigo-600 font-medium bg-indigo-50"
                    @click="openGroup = null"
                  >
                    <AppIcon v-if="child.icon" :name="child.icon" class="h-4 w-4" />
                    {{ child.label }}
                  </RouterLink>
                </div>
              </Transition>
            </div>
          </template>

          <button
            class="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            @click="closeAllAndLogout"
          >
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

              <div v-if="notifStore.loading" class="py-6 text-center text-xs text-gray-400">
                Loading…
              </div>

              <div v-else-if="notifStore.items.length === 0" class="py-6 text-center text-xs text-gray-400">
                No notifications yet.
              </div>

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

          <Transition name="menu">
            <nav
              v-if="menuOpen"
              role="menu"
              aria-label="Main navigation"
              class="absolute right-0 top-full mt-1 w-56 max-h-[80vh] overflow-y-auto bg-white rounded-lg shadow-md border border-gray-100 z-40 py-1"
            >
              <template v-for="item in navItems" :key="item.label">
                <!-- Flat link -->
                <RouterLink
                  v-if="!isGroup(item)"
                  :to="item.to"
                  role="menuitem"
                  class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                  :active-class="item.exact ? '' : 'text-indigo-600 font-medium bg-indigo-50'"
                  exact-active-class="text-indigo-600 font-medium bg-indigo-50"
                  @click="menuOpen = false"
                >
                  <AppIcon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
                  {{ item.label }}
                </RouterLink>

                <!-- Collapsible group -->
                <div v-else>
                  <button
                    type="button"
                    class="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    :class="{ 'text-indigo-600 font-medium': groupIsActive(item) }"
                    :aria-expanded="mobileOpenSections.has(item.label)"
                    @click="toggleMobileSection(item.label)"
                  >
                    <span class="flex items-center gap-2">
                      <AppIcon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
                      {{ item.label }}
                    </span>
                    <svg
                      class="h-3 w-3 transition-transform"
                      :class="{ 'rotate-180': mobileOpenSections.has(item.label) }"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div v-if="mobileOpenSections.has(item.label)" class="bg-gray-50/60">
                    <RouterLink
                      v-for="child in item.children"
                      :key="child.to"
                      :to="child.to"
                      role="menuitem"
                      class="flex items-center gap-2 pl-9 pr-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                      :active-class="child.exact ? '' : 'text-indigo-600 font-medium'"
                      exact-active-class="text-indigo-600 font-medium"
                      @click="menuOpen = false"
                    >
                      <AppIcon v-if="child.icon" :name="child.icon" class="h-4 w-4" />
                      {{ child.label }}
                    </RouterLink>

                  </div>
                </div>
              </template>

              <button
                role="menuitem"
                class="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                @click="closeAllAndLogout"
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
