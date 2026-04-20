<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePollStore } from '@/stores/pollStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { pollOptionImageUrl } from '@/api/polls'
import { formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import DonutChart from '@/components/DonutChart.vue'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9']

const route = useRoute()
const router = useRouter()
const pollStore = usePollStore()
const auth = useAuthStore()
const toastStore = useToastStore()
const { confirm } = useConfirm()

const id = route.params.id as string
const poll = computed(() => pollStore.current)

const isAdmin = computed(() => auth.user?.role === 'admin')

const selectedOptionId = ref('')
const voting = ref(false)
const expandedVoters = ref(new Set<string>())

function toggleVoters(optionId: string) {
  if (expandedVoters.value.has(optionId)) {
    expandedVoters.value.delete(optionId)
  } else {
    expandedVoters.value.add(optionId)
  }
  expandedVoters.value = new Set(expandedVoters.value)
}

// Admins always see results; others see results after voting or when poll isn't active
const showResults = computed(() =>
  isAdmin.value || !!poll.value?.myVotedOptionId || poll.value?.status !== 'active',
)
const showVoting = computed(() =>
  !isAdmin.value && poll.value?.status === 'active' && !poll.value?.myVotedOptionId,
)

const statusBadge = computed(() => {
  switch (poll.value?.status) {
    case 'active': return { label: 'Active', cls: 'bg-green-100 text-green-700' }
    case 'upcoming': return { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' }
    case 'expired': return { label: 'Expired', cls: 'bg-gray-100 text-gray-500' }
    default: return null
  }
})

const chartSegments = computed(() => {
  if (!poll.value) return []
  return poll.value.options.map((opt, i) => ({
    label: opt.label,
    value: opt.voteCount,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))
})

async function handleVote() {
  if (!selectedOptionId.value) return
  voting.value = true
  try {
    await pollStore.vote(id, selectedOptionId.value)
    toastStore.show('Vote submitted.', 'success')
  } catch {
    toastStore.show('Failed to submit vote.', 'error')
  } finally {
    voting.value = false
  }
}

async function handleDelete() {
  const ok = await confirm({
    title: 'Delete poll?',
    message: 'This will permanently remove the poll and all votes.',
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await pollStore.remove(id)
    toastStore.show('Poll deleted.', 'success')
    router.push('/polls')
  } catch {
    toastStore.show('Failed to delete poll.', 'error')
  }
}

onMounted(() => pollStore.fetchPoll(id))
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/polls')"
    >
      ← Back to polls
    </button>

    <div v-if="pollStore.loading && !poll" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="poll" class="flex flex-col gap-4">
      <!-- Header card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between gap-3 mb-2">
          <h1 class="text-lg font-semibold text-gray-900">
            {{ poll.title }}
          </h1>
          <div class="flex items-center gap-2 shrink-0">
            <span
              v-if="statusBadge"
              class="inline-block rounded-full text-xs px-2 py-0.5 font-medium"
              :class="statusBadge.cls"
            >{{ statusBadge.label }}</span>
            <div v-if="isAdmin" class="flex gap-1.5">
              <AppButton variant="secondary" @click="router.push(`/admin/polls/${id}/edit`)">
                <AppIcon name="edit" class="h-4 w-4" />
              </AppButton>
              <AppButton variant="danger" @click="handleDelete">
                <AppIcon name="trash" class="h-4 w-4" />
              </AppButton>
            </div>
          </div>
        </div>

        <p v-if="poll.description" class="text-sm text-gray-600 mb-2.5 whitespace-pre-wrap">{{ poll.description }}</p>

        <p class="text-xs text-gray-400 flex items-center gap-1.5">
          <AppIcon name="calendar" class="h-3.5 w-3.5 shrink-0" />
          {{ formatDate(poll.startDate) }} – {{ formatDate(poll.endDate) }}
        </p>
      </div>

      <!-- Voting card (active + not voted, non-admin) -->
      <div v-if="showVoting" class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
        <p class="text-sm font-medium text-gray-900">Cast your vote</p>

        <div class="flex flex-col gap-2">
          <label
            v-for="option in poll.options"
            :key="option.id"
            class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="selectedOptionId === option.id
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-200 hover:border-indigo-200'"
          >
            <input
              v-model="selectedOptionId"
              type="radio"
              :value="option.id"
              class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 shrink-0"
            />
            <img
              v-if="option.hasImage"
              :src="pollOptionImageUrl(poll.id, option.id)"
              :alt="option.label"
              class="h-12 w-12 object-cover rounded shrink-0"
            />
            <span class="text-sm text-gray-900">{{ option.label }}</span>
          </label>
        </div>

        <AppButton :disabled="!selectedOptionId || voting" @click="handleVote">
          {{ voting ? 'Submitting…' : 'Submit vote' }}
        </AppButton>
      </div>

      <!-- Results card (after voting, expired, or admin) -->
      <div v-if="showResults" class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
        <p class="text-sm font-medium text-gray-900">Results</p>

        <DonutChart :segments="chartSegments" class="max-w-[180px] mx-auto w-full" />

        <div class="flex flex-col gap-2">
          <div
            v-for="(option, i) in poll.options"
            :key="option.id"
            class="flex items-center gap-3 p-2.5 rounded-lg"
            :class="option.id === poll.myVotedOptionId
              ? 'bg-indigo-50 border border-indigo-200'
              : 'bg-gray-50'"
          >
            <span
              class="h-3 w-3 rounded-full shrink-0"
              :style="{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }"
            />
            <img
              v-if="option.hasImage"
              :src="pollOptionImageUrl(poll.id, option.id)"
              :alt="option.label"
              class="h-8 w-8 object-cover rounded shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 truncate">{{ option.label }}</p>
              <p class="text-xs text-gray-400">
                {{ poll.totalVotes > 0 ? Math.round(option.voteCount / poll.totalVotes * 100) : 0 }}%
                · {{ option.voteCount }} vote{{ option.voteCount !== 1 ? 's' : '' }}
              </p>
            </div>
            <span
              v-if="option.id === poll.myVotedOptionId"
              class="text-xs text-indigo-600 font-medium shrink-0"
            >
              Your choice
            </span>
          </div>

          <!-- Collapsible voters list (admin/teacher only — voters field absent for students) -->
          <template v-for="option in poll.options" :key="`voters-${option.id}`">
            <div v-if="option.voters !== undefined" class="pl-3">
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                @click="toggleVoters(option.id)"
              >
                <AppIcon
                  :name="expandedVoters.has(option.id) ? 'chevron-up' : 'chevron-down'"
                  class="h-3 w-3"
                />
                <span class="font-medium">{{ option.label }}</span>
                — Who voted ({{ option.voters.length }})
              </button>
              <div v-if="expandedVoters.has(option.id)" class="ml-5 mt-1 flex flex-col gap-1">
                <div
                  v-for="voter in option.voters"
                  :key="voter.id"
                  class="flex items-center gap-2 text-xs text-gray-600"
                >
                  <span>{{ voter.name }}</span>
                  <span
                    v-if="voter.className"
                    class="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500 text-[10px]"
                  >{{ voter.className }}</span>
                </div>
                <p v-if="option.voters.length === 0" class="text-xs text-gray-400 italic">No voters yet.</p>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Poll not found.</div>
  </div>
</template>
