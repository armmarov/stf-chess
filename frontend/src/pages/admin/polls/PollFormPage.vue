<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePollStore } from '@/stores/pollStore'
import { useToastStore } from '@/stores/toastStore'
import { pollOptionImageUrl } from '@/api/polls'
import AppInput from '@/components/AppInput.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const pollStore = usePollStore()
const toastStore = useToastStore()

const pollId = route.params.id as string | undefined
const isEdit = !!pollId
const poll = computed(() => pollStore.current)

const title = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const submitting = ref(false)

interface OptionRow {
  label: string
  imageFile: File | null
  previewUrl: string
}

const optionRows = ref<OptionRow[]>([
  { label: '', imageFile: null, previewUrl: '' },
  { label: '', imageFile: null, previewUrl: '' },
])

function addOption() {
  if (optionRows.value.length < 10) {
    optionRows.value.push({ label: '', imageFile: null, previewUrl: '' })
  }
}

function removeOption(i: number) {
  if (optionRows.value.length <= 2) return
  const row = optionRows.value[i]
  if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
  optionRows.value.splice(i, 1)
}

function handleOptionImage(i: number, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const row = optionRows.value[i]
  if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
  row.imageFile = file
  row.previewUrl = URL.createObjectURL(file)
}

onBeforeUnmount(() => {
  optionRows.value.forEach((row) => {
    if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
  })
})

onMounted(async () => {
  if (isEdit && pollId) {
    await pollStore.fetchPoll(pollId)
    if (poll.value) {
      title.value = poll.value.title
      description.value = poll.value.description ?? ''
      startDate.value = poll.value.startDate.slice(0, 16)
      endDate.value = poll.value.endDate.slice(0, 16)
    }
  }
})

const canSubmit = computed(() => {
  if (!title.value.trim() || !startDate.value || !endDate.value) return false
  if (!isEdit) {
    return optionRows.value.filter((o) => o.label.trim()).length >= 2
  }
  return true
})

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    if (isEdit && pollId) {
      await pollStore.update(pollId, {
        title: title.value.trim(),
        description: description.value.trim() || null,
        startDate: startDate.value,
        endDate: endDate.value,
      })
      toastStore.show('Poll updated.', 'success')
      router.push(`/polls/${pollId}`)
    } else {
      const validRows = optionRows.value.filter((o) => o.label.trim())
      const created = await pollStore.create(
        {
          title: title.value.trim(),
          description: description.value.trim() || undefined,
          startDate: startDate.value,
          endDate: endDate.value,
          options: validRows.map((o) => ({ label: o.label.trim() })),
        },
        validRows.map((o) => o.imageFile),
      )
      toastStore.show('Poll created.', 'success')
      router.push(`/polls/${created.id}`)
    }
  } catch {
    toastStore.show('Failed to save poll.', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/polls')"
    >
      ← Back to polls
    </button>

    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="clipboard" class="h-5 w-5 text-indigo-600" />
      {{ isEdit ? 'Edit Poll' : 'New Poll' }}
    </h1>

    <div v-if="pollStore.loading && isEdit && !poll" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Core fields -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
        <AppInput v-model="title" label="Title" placeholder="Poll question or title" required />

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Description (optional)</label>
          <textarea
            v-model="description"
            rows="3"
            placeholder="Additional context…"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-700">Start <span class="text-red-500">*</span></label>
            <input
              v-model="startDate"
              type="datetime-local"
              required
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-700">End <span class="text-red-500">*</span></label>
            <input
              v-model="endDate"
              type="datetime-local"
              required
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <!-- Options -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-gray-900">Options</p>
          <span v-if="isEdit" class="text-xs text-gray-400 italic">Read-only after creation</span>
        </div>

        <!-- Edit mode: read-only -->
        <template v-if="isEdit && poll">
          <div
            v-for="option in poll.options"
            :key="option.id"
            class="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
          >
            <img
              v-if="option.hasImage"
              :src="pollOptionImageUrl(poll.id, option.id)"
              :alt="option.label"
              class="h-10 w-10 object-cover rounded shrink-0"
            />
            <span class="text-sm text-gray-700">{{ option.label }}</span>
          </div>
        </template>

        <!-- Create mode: editable -->
        <template v-else>
          <div
            v-for="(row, i) in optionRows"
            :key="i"
            class="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-400 w-5 shrink-0">{{ i + 1 }}.</span>
              <input
                v-model="row.label"
                type="text"
                :placeholder="`Option ${i + 1}`"
                class="flex-1 block rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <button
                v-if="optionRows.length > 2"
                type="button"
                class="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                @click="removeOption(i)"
              >
                <AppIcon name="x-mark" class="h-4 w-4" />
              </button>
            </div>
            <div class="pl-7 flex flex-col gap-1">
              <img
                v-if="row.previewUrl"
                :src="row.previewUrl"
                alt="Preview"
                class="h-16 w-16 object-cover rounded"
              />
              <input
                type="file"
                accept="image/*"
                class="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                @change="(e) => handleOptionImage(i, e)"
              />
            </div>
          </div>

          <button
            v-if="optionRows.length < 10"
            type="button"
            class="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            @click="addOption"
          >
            <AppIcon name="plus" class="h-4 w-4" />
            Add option
          </button>
        </template>
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <AppButton class="flex-1" :disabled="submitting || !canSubmit" @click="handleSubmit">
          {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Poll' }}
        </AppButton>
        <AppButton variant="secondary" class="flex-1" :disabled="submitting" @click="router.push('/polls')">
          Cancel
        </AppButton>
      </div>
    </div>
  </div>
</template>
