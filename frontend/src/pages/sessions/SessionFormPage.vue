<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import { useSessionStore } from '@/stores/sessionStore'
import { toHHMM, toDateString } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const editId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => Boolean(editId.value))
const submitting = ref(false)
const serverError = ref('')

const form = reactive({
  date: '',
  startTime: '',
  endTime: '',
  place: '',
  notes: '',
})

const fieldErrors = reactive<Record<string, string>>({
  date: '',
  startTime: '',
  endTime: '',
  place: '',
  notes: '',
})

const schema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    place: z.string().min(1, 'Place is required').max(255, 'Place too long'),
    notes: z.string().max(1000, 'Notes too long').optional(),
  })
  .refine((d) => !d.startTime || !d.endTime || d.startTime < d.endTime, {
    message: 'Start time must be before end time',
    path: ['startTime'],
  })

function clearErrors() {
  Object.keys(fieldErrors).forEach((k) => (fieldErrors[k] = ''))
}

onMounted(async () => {
  if (isEdit.value && editId.value) {
    await sessionStore.fetchSession(editId.value)
    const s = sessionStore.current
    if (s) {
      form.date = toDateString(s.date)
      form.startTime = toHHMM(s.startTime)
      form.endTime = toHHMM(s.endTime)
      form.place = s.place
      form.notes = s.notes ?? ''
    }
  }
})

async function handleSubmit() {
  clearErrors()
  serverError.value = ''

  const result = schema.safeParse(form)
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const key = issue.path[0] as string
      if (key in fieldErrors) fieldErrors[key] = issue.message
    })
    return
  }

  submitting.value = true
  try {
    const body = {
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      place: form.place,
      notes: form.notes || undefined,
    }
    if (isEdit.value && editId.value) {
      await sessionStore.updateSession(editId.value, body)
      router.push(`/sessions/${editId.value}`)
    } else {
      const created = await sessionStore.createSession(body)
      router.push(`/sessions/${created.id}`)
    }
  } catch {
    serverError.value = 'Failed to save session. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <div class="flex items-center gap-3 mb-5">
      <button class="text-indigo-600 text-sm hover:underline" @click="router.back()">← Back</button>
      <h1 class="text-lg font-semibold text-gray-900">
        {{ isEdit ? 'Edit Session' : 'New Session' }}
      </h1>
    </div>

    <form class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4" @submit.prevent="handleSubmit">
      <AppInput
        v-model="form.date"
        label="Date"
        type="date"
        required
        :error="fieldErrors.date"
      />

      <div class="grid grid-cols-2 gap-3">
        <AppInput
          v-model="form.startTime"
          label="Start Time"
          type="time"
          required
          :error="fieldErrors.startTime"
        />
        <AppInput
          v-model="form.endTime"
          label="End Time"
          type="time"
          required
          :error="fieldErrors.endTime"
        />
      </div>

      <AppInput
        v-model="form.place"
        label="Place / Venue"
        type="text"
        placeholder="e.g. School Hall, Room 3"
        required
        :error="fieldErrors.place"
      />

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">
          Notes <span class="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          v-model="form.notes"
          rows="3"
          maxlength="1000"
          placeholder="Any additional notes…"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <p v-if="fieldErrors.notes" class="text-xs text-red-600">{{ fieldErrors.notes }}</p>
      </div>

      <p v-if="serverError" role="alert" class="text-sm text-red-600">{{ serverError }}</p>

      <div class="flex gap-3 pt-1">
        <AppButton type="submit" :disabled="submitting">
          {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Session' }}
        </AppButton>
        <AppButton variant="secondary" type="button" @click="router.back()">Cancel</AppButton>
      </div>
    </form>
  </div>
</template>
