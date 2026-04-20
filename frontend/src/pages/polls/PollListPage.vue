<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePollStore } from '@/stores/pollStore'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const pollStore = usePollStore()
const auth = useAuthStore()
const router = useRouter()

const isAdmin = computed(() => auth.user?.role === 'admin')
const activeTab = ref<'active' | 'expired'>('active')

const activePolls = computed(() =>
  pollStore.list.filter((p) => p.status === 'active' || p.status === 'not_started'),
)
const expiredPolls = computed(() =>
  pollStore.list.filter((p) => p.status === 'expired'),
)
const displayList = computed(() =>
  activeTab.value === 'active' ? activePolls.value : expiredPolls.value,
)

onMounted(() => pollStore.fetchList())
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="clipboard" class="h-5 w-5 text-indigo-600" />
        Polls
      </h1>
      <AppButton v-if="isAdmin" @click="router.push('/admin/polls/new')">
        <AppIcon name="plus" class="h-4 w-4" />
        New Poll
      </AppButton>
    </div>

    <div v-if="pollStore.loading && pollStore.list.length === 0" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="flex border-b border-gray-200 mb-4" role="tablist">
        <button
          role="tab"
          :aria-selected="activeTab === 'active'"
          class="flex-1 text-sm font-medium py-2 -mb-px border-b-2 transition-colors"
          :class="activeTab === 'active' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'active'"
        >
          Active
          <span class="ml-1 text-xs text-gray-400">({{ activePolls.length }})</span>
        </button>
        <button
          role="tab"
          :aria-selected="activeTab === 'expired'"
          class="flex-1 text-sm font-medium py-2 -mb-px border-b-2 transition-colors"
          :class="activeTab === 'expired' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'expired'"
        >
          Expired
          <span class="ml-1 text-xs text-gray-400">({{ expiredPolls.length }})</span>
        </button>
      </div>

      <div v-if="displayList.length === 0" class="text-center py-10 text-gray-400 text-sm">
        No {{ activeTab === 'active' ? 'active' : 'expired' }} polls.
      </div>

      <div v-else class="flex flex-col gap-3">
        <div
          v-for="poll in displayList"
          :key="poll.id"
          class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors"
          @click="router.push(`/polls/${poll.id}`)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 text-sm">{{ poll.title }}</p>
              <span class="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 mt-1.5 font-medium">
                <AppIcon name="calendar" class="h-3 w-3 shrink-0" />
                {{ formatDate(poll.startDate) }} – {{ formatDate(poll.endDate) }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="poll.myVoted"
                class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium"
              >
                Voted ✓
              </span>
              <span class="text-gray-400 text-sm">→</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
