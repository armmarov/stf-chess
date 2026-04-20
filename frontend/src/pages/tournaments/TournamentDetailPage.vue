<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { tournamentImageUrl } from '@/api/tournaments'
import { formatDate } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const tournamentStore = useTournamentStore()
const auth = useAuthStore()
const toastStore = useToastStore()
const { confirm } = useConfirm()

const id = route.params.id as string
const tournament = computed(() => tournamentStore.current)

const isAdmin = computed(() => auth.user?.role === 'admin')
const isStudent = computed(() => auth.user?.role === 'student')

async function toggleInterest() {
  if (!tournament.value) return
  try {
    await tournamentStore.toggleInterest(id, !tournament.value.myInterested)
    // Refetch to get updated interestedStudents list
    await tournamentStore.fetchTournament(id)
  } catch {
    toastStore.show('Failed to update interest.', 'error')
  }
}

async function handleDelete() {
  const ok = await confirm({
    title: 'Delete tournament?',
    message: 'This will permanently remove the tournament and all interest records.',
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await tournamentStore.remove(id)
    toastStore.show('Tournament deleted.', 'success')
    router.push('/tournaments')
  } catch {
    toastStore.show('Failed to delete tournament.', 'error')
  }
}

onMounted(() => tournamentStore.fetchTournament(id))
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/tournaments')"
    >
      ← Back to tournaments
    </button>

    <div v-if="tournamentStore.loading && !tournament" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="tournament" class="flex flex-col gap-4">
      <!-- Image -->
      <img
        v-if="tournament.hasImage"
        :src="tournamentImageUrl(tournament.id)"
        :alt="tournament.name"
        class="w-full max-h-64 object-cover rounded-lg"
      />

      <!-- Main card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between gap-3 mb-4">
          <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
            <AppIcon name="trophy" class="h-5 w-5 text-indigo-500 shrink-0" />
            {{ tournament.name }}
          </h1>

          <!-- Admin actions -->
          <div v-if="isAdmin" class="flex gap-2 shrink-0">
            <AppButton
              variant="secondary"
              @click="router.push(`/admin/tournaments/${id}/edit`)"
            >
              <AppIcon name="edit" class="h-4 w-4" />
              Edit
            </AppButton>
            <AppButton variant="danger" @click="handleDelete">
              <AppIcon name="trash" class="h-4 w-4" />
              Delete
            </AppButton>
          </div>
        </div>

        <dl class="flex flex-col gap-3 text-sm">
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="calendar" class="h-3.5 w-3.5" />
              Date
            </dt>
            <dd class="text-gray-900 mt-0.5">
              {{ formatDate(tournament.startDate) }}
              <span v-if="tournament.endDate"> – {{ formatDate(tournament.endDate) }}</span>
            </dd>
          </div>

          <div v-if="tournament.description">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="document" class="h-3.5 w-3.5" />
              About
            </dt>
            <dd class="text-gray-900 mt-0.5 whitespace-pre-wrap">{{ tournament.description }}</dd>
          </div>

          <div v-if="tournament.registrationLink">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1.5">
              <AppIcon name="link" class="h-3.5 w-3.5" />
              Registration
            </dt>
            <dd>
              <a
                :href="tournament.registrationLink"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
                Register now
                <AppIcon name="link" class="h-3.5 w-3.5" />
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Interest card (student) -->
      <div v-if="isStudent" class="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-900">Interested in joining?</p>
          <p class="text-xs text-gray-400 mt-0.5">{{ tournament.interestCount }} student{{ tournament.interestCount !== 1 ? 's' : '' }} interested</p>
        </div>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="tournament.myInterested"
            class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            @change="toggleInterest"
          />
          <span class="text-sm text-gray-700">I want to join</span>
        </label>
      </div>

      <!-- Interested students list (all roles) -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h2 class="text-sm font-semibold text-gray-900 mb-3">
          Interested students ({{ tournament.interestCount }})
        </h2>

        <div v-if="!tournament.interestedStudents || tournament.interestedStudents.length === 0" class="text-sm text-gray-400">
          No students have expressed interest yet.
        </div>

        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="student in tournament.interestedStudents"
            :key="student.id"
            class="flex items-center justify-between gap-2"
          >
            <span class="text-sm text-gray-900">{{ student.name }}</span>
            <span
              v-if="student.className"
              class="inline-block rounded-full bg-gray-100 text-gray-600 text-xs px-2 py-0.5 font-medium shrink-0"
            >
              {{ student.className }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Tournament not found.</div>
  </div>
</template>
