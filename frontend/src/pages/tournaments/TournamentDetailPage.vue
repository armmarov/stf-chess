<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { tournamentImageUrl, tournamentLetterUrl } from '@/api/tournaments'
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

const lightboxOpen = ref(false)

function pajskBadgeClass(target: string): string {
  const map: Record<string, string> = {
    tiada: 'bg-gray-100 text-gray-600',
    sekolah: 'bg-gray-100 text-gray-700',
    daerah: 'bg-blue-100 text-blue-700',
    negeri: 'bg-purple-100 text-purple-700',
    kebangsaan: 'bg-orange-100 text-orange-700',
    antarabangsa: 'bg-red-100 text-red-700',
  }
  return map[target] ?? 'bg-gray-100 text-gray-600'
}

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
      <!-- Image — click to open lightbox -->
      <img
        v-if="tournament.hasImage"
        :src="tournamentImageUrl(tournament.id)"
        :alt="tournament.name"
        class="w-full max-h-64 object-cover rounded-lg cursor-zoom-in"
        @click="lightboxOpen = true"
      />

      <!-- Main card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between gap-3 mb-4">
          <h1 class="text-lg font-semibold text-gray-900">
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

          <div v-if="tournament.place">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="map-pin" class="h-3.5 w-3.5" />
              Venue
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ tournament.place }}</dd>
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

          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1.5">
              <AppIcon name="tag" class="h-3.5 w-3.5" />
              Target PAJSK
            </dt>
            <dd>
              <span
                class="inline-block text-xs rounded-full px-2 py-0.5 font-medium capitalize"
                :class="pajskBadgeClass(tournament.targetPajsk)"
              >
                {{ tournament.targetPajsk }}
              </span>
            </dd>
          </div>

          <div v-if="tournament.resultUrl">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1.5">
              <AppIcon name="trophy" class="h-3.5 w-3.5" />
              Chess Result
            </dt>
            <dd>
              <a
                :href="tournament.resultUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
                View results
                <AppIcon name="link" class="h-3.5 w-3.5" />
              </a>
            </dd>
          </div>

          <div v-if="tournament.hasBskkLetter || tournament.hasKpmLetter">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1.5">
              <AppIcon name="download" class="h-3.5 w-3.5" />
              Letters
            </dt>
            <dd class="flex flex-wrap gap-2">
              <a
                v-if="tournament.hasBskkLetter"
                :href="tournamentLetterUrl(tournament.id, 'bskk')"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
                <AppIcon name="download" class="h-3.5 w-3.5" />
                BSKK Pre-Approval
              </a>
              <a
                v-if="tournament.hasKpmLetter"
                :href="tournamentLetterUrl(tournament.id, 'kpm')"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
                <AppIcon name="download" class="h-3.5 w-3.5" />
                KPM Recognition
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

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen && tournament?.hasImage"
        class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        role="dialog"
        aria-modal="true"
        aria-label="Tournament image"
        @click="lightboxOpen = false"
        @keydown.esc="lightboxOpen = false"
        tabindex="0"
      >
        <button
          class="absolute top-4 right-4 text-white/80 hover:text-white"
          aria-label="Close"
          @click.stop="lightboxOpen = false"
        >
          <AppIcon name="x-mark" class="h-6 w-6" />
        </button>
        <img
          :src="tournamentImageUrl(tournament.id)"
          :alt="tournament.name"
          class="max-w-full max-h-full object-contain"
          @click.stop
        />
      </div>
    </Teleport>
  </div>
</template>
