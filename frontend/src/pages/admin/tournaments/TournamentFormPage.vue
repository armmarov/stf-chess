<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useToastStore } from '@/stores/toastStore'
import { tournamentImageUrl, tournamentLetterUrl } from '@/api/tournaments'
import AppInput from '@/components/AppInput.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const tournamentStore = useTournamentStore()
const toastStore = useToastStore()

const isEdit = computed(() => !!route.params.id)
const tournamentId = computed(() => route.params.id as string | undefined)
const tournament = computed(() => tournamentStore.current)

const name = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const place = ref('')
const registrationLink = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const removeImage = ref(false)

const resultUrl = ref('')
const bskkLetterFile = ref<File | null>(null)
const kpmLetterFile = ref<File | null>(null)
const removeBskkLetter = ref(false)
const removeKpmLetter = ref(false)

const submitting = ref(false)

const PDF_MAX_BYTES = 5 * 1024 * 1024

function handleLetterSelect(which: 'bskk' | 'kpm', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.type !== 'application/pdf') {
    toastStore.show('Letter must be a PDF.', 'error')
    ;(e.target as HTMLInputElement).value = ''
    return
  }
  if (file.size > PDF_MAX_BYTES) {
    toastStore.show('PDF exceeds 5 MB limit.', 'error')
    ;(e.target as HTMLInputElement).value = ''
    return
  }
  if (which === 'bskk') {
    bskkLetterFile.value = file
    removeBskkLetter.value = false
  } else {
    kpmLetterFile.value = file
    removeKpmLetter.value = false
  }
}

function handleImageSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
  removeImage.value = false
}

onBeforeUnmount(() => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
})

onMounted(async () => {
  if (isEdit.value && tournamentId.value) {
    await tournamentStore.fetchTournament(tournamentId.value)
    if (tournament.value) {
      name.value = tournament.value.name
      description.value = tournament.value.description ?? ''
      startDate.value = tournament.value.startDate.slice(0, 10)
      endDate.value = tournament.value.endDate?.slice(0, 10) ?? ''
      place.value = tournament.value.place ?? ''
      registrationLink.value = tournament.value.registrationLink ?? ''
      resultUrl.value = tournament.value.resultUrl ?? ''
    }
  }
})

async function handleSubmit() {
  if (!name.value.trim() || !startDate.value) return
  submitting.value = true
  try {
    if (isEdit.value && tournamentId.value) {
      await tournamentStore.update(tournamentId.value, {
        name: name.value.trim(),
        description: description.value.trim() || null,
        startDate: startDate.value,
        endDate: endDate.value || null,
        place: place.value.trim() || null,
        registrationLink: registrationLink.value.trim() || null,
        resultUrl: resultUrl.value.trim() || null,
        image: imageFile.value ?? undefined,
        bskkLetter: bskkLetterFile.value ?? undefined,
        kpmLetter: kpmLetterFile.value ?? undefined,
        removeImage: removeImage.value,
        removeBskkLetter: removeBskkLetter.value,
        removeKpmLetter: removeKpmLetter.value,
      })
      toastStore.show('Tournament updated.', 'success')
      router.push(`/tournaments/${tournamentId.value}`)
    } else {
      const t = await tournamentStore.create({
        name: name.value.trim(),
        description: description.value.trim() || undefined,
        startDate: startDate.value,
        endDate: endDate.value || undefined,
        place: place.value.trim() || undefined,
        registrationLink: registrationLink.value.trim() || undefined,
        resultUrl: resultUrl.value.trim() || undefined,
        image: imageFile.value ?? undefined,
        bskkLetter: bskkLetterFile.value ?? undefined,
        kpmLetter: kpmLetterFile.value ?? undefined,
      })
      toastStore.show('Tournament created.', 'success')
      router.push(`/tournaments/${t.id}`)
    }
  } catch {
    toastStore.show('Failed to save tournament.', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/tournaments')"
    >
      ← Back to tournaments
    </button>

    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="trophy" class="h-5 w-5 text-indigo-600" />
      {{ isEdit ? 'Edit Tournament' : 'New Tournament' }}
    </h1>

    <div v-if="tournamentStore.loading && isEdit && !tournament" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
      <AppInput
        v-model="name"
        label="Name"
        placeholder="Tournament name"
        required
      />

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Description (optional)</label>
        <textarea
          v-model="description"
          rows="4"
          placeholder="Describe the tournament…"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Start Date <span class="text-red-500">*</span></label>
          <input
            v-model="startDate"
            type="date"
            required
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">End Date (optional)</label>
          <input
            v-model="endDate"
            type="date"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <AppInput
        v-model="place"
        label="Venue / Place (optional)"
        placeholder="e.g. Dewan Serbaguna, Kuala Lumpur"
      />

      <AppInput
        v-model="registrationLink"
        label="Registration Link (optional)"
        placeholder="https://…"
        type="url"
      />

      <AppInput
        v-model="resultUrl"
        label="Chess Result Link (optional)"
        placeholder="https://chess-results.com/…"
        type="url"
      />

      <!-- BSKK Pre-Approval Letter (PDF) -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">BSKK Pre-Approval Letter (PDF, optional)</label>
        <div v-if="isEdit && tournament?.hasBskkLetter && !removeBskkLetter && !bskkLetterFile" class="flex items-center gap-3 text-sm">
          <a :href="tournamentLetterUrl(tournamentId!, 'bskk')" target="_blank" rel="noopener"
             class="text-indigo-600 hover:underline inline-flex items-center gap-1">
            <AppIcon name="download" class="h-4 w-4" /> View current PDF
          </a>
          <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
            <input v-model="removeBskkLetter" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500" />
            Remove
          </label>
        </div>
        <p v-else-if="bskkLetterFile" class="text-xs text-gray-600">Selected: {{ bskkLetterFile.name }}</p>
        <input
          type="file"
          accept="application/pdf"
          class="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          @change="handleLetterSelect('bskk', $event)"
        />
      </div>

      <!-- KPM Recognition Letter (PDF) -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">KPM Recognition Letter (PDF, optional)</label>
        <div v-if="isEdit && tournament?.hasKpmLetter && !removeKpmLetter && !kpmLetterFile" class="flex items-center gap-3 text-sm">
          <a :href="tournamentLetterUrl(tournamentId!, 'kpm')" target="_blank" rel="noopener"
             class="text-indigo-600 hover:underline inline-flex items-center gap-1">
            <AppIcon name="download" class="h-4 w-4" /> View current PDF
          </a>
          <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
            <input v-model="removeKpmLetter" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500" />
            Remove
          </label>
        </div>
        <p v-else-if="kpmLetterFile" class="text-xs text-gray-600">Selected: {{ kpmLetterFile.name }}</p>
        <input
          type="file"
          accept="application/pdf"
          class="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          @change="handleLetterSelect('kpm', $event)"
        />
      </div>

      <!-- Image upload -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Image (optional)</label>

        <!-- Current image in edit mode -->
        <div v-if="isEdit && tournament?.hasImage && !removeImage && !imagePreviewUrl" class="mb-2">
          <img
            :src="tournamentImageUrl(tournamentId!)"
            alt="Current image"
            class="w-full max-h-40 object-cover rounded-md"
          />
          <label class="mt-2 flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input v-model="removeImage" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500" />
            Remove current image
          </label>
        </div>

        <!-- New image preview -->
        <img
          v-if="imagePreviewUrl"
          :src="imagePreviewUrl"
          alt="Preview"
          class="w-full max-h-40 object-cover rounded-md mb-2"
        />

        <input
          type="file"
          accept="image/*"
          class="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          @change="handleImageSelect"
        />
      </div>

      <div class="flex gap-3 pt-1">
        <AppButton
          class="flex-1"
          :disabled="submitting || !name.trim() || !startDate"
          @click="handleSubmit"
        >
          {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tournament' }}
        </AppButton>
        <AppButton
          variant="secondary"
          class="flex-1"
          :disabled="submitting"
          @click="router.push('/tournaments')"
        >
          Cancel
        </AppButton>
      </div>
    </div>
  </div>
</template>
