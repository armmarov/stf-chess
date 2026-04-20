<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { CLASS_VALUES } from '@/utils/classNames'
import type { ClassName } from '@/utils/classNames'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()

const id = route.params.id as string

const name = ref('')
const phone = ref('')
const className = ref<ClassName | ''>('')
const username = ref('')

const submitting = ref(false)
const error = ref('')
const notFound = ref(false)

onMounted(async () => {
  try {
    await userStore.fetchUser(id)
    const u = userStore.current
    if (!u) { notFound.value = true; return }
    name.value = u.name
    phone.value = u.phone ?? ''
    className.value = u.className ?? ''
    username.value = u.username
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 403) {
      notFound.value = true
    } else {
      toastStore.show('Failed to load student.', 'error')
    }
  }
})

function validate(): string {
  if (!name.value.trim()) return 'Name is required.'
  return ''
}

async function submit() {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    await userStore.updateUser(id, {
      name: name.value.trim(),
      phone: phone.value.trim() || null,
      className: className.value || null,
    })
    toastStore.show('Student updated.', 'success')
    router.push('/teacher/students')
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      error.value = 'You do not have permission to edit this student.'
    } else if (status === 404) {
      error.value = 'Student not found.'
    } else {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = msg ?? 'Something went wrong. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/teacher/students')"
    >
      ← Back to students
    </button>

    <h1 class="text-lg font-semibold text-gray-900 mb-4">Edit Student</h1>

    <div v-if="userStore.loading" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="notFound" class="text-center py-10 text-gray-400 text-sm">
      Student not found.
    </div>

    <form
      v-else
      class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <div>
        <p class="text-xs font-medium text-gray-500 mb-1">Username</p>
        <p class="text-sm text-gray-700 bg-gray-50 rounded border border-gray-200 px-3 py-2">
          {{ username }}
        </p>
      </div>

      <AppInput v-model="name" label="Name" placeholder="Full name" required autocomplete="name" />
      <AppInput v-model="phone" label="Phone" placeholder="+60xxxxxxxxx" autocomplete="tel" />
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-700">Class (optional)</label>
        <select
          v-model="className"
          class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="">— Not set —</option>
          <option v-for="c in CLASS_VALUES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>

      <AppButton type="submit" :disabled="submitting" class="w-full">
        {{ submitting ? 'Saving…' : 'Save Changes' }}
      </AppButton>
    </form>
  </div>
</template>
