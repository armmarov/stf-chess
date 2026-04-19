<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()

const name = ref('')
const username = ref('')
const password = ref('')
const phone = ref('')

const submitting = ref(false)
const error = ref('')

function validate(): string {
  if (!name.value.trim()) return 'Name is required.'
  if (!username.value.trim()) return 'Username is required.'
  if (password.value.length < 8) return 'Password must be at least 8 characters.'
  return ''
}

async function submit() {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    await userStore.createUser({
      name: name.value.trim(),
      username: username.value.trim(),
      password: password.value,
      role: 'student',
      phone: phone.value.trim() || undefined,
    })
    toastStore.show('Student created.', 'success')
    router.push('/teacher/students')
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    error.value = msg ?? 'Something went wrong. Please try again.'
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

    <h1 class="text-lg font-semibold text-gray-900 mb-4">New Student</h1>

    <form class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4" @submit.prevent="submit">
      <AppInput v-model="name" label="Name" placeholder="Full name" required autocomplete="name" />
      <AppInput
        v-model="username"
        label="Username"
        placeholder="username"
        required
        autocomplete="username"
      />
      <AppInput
        v-model="password"
        label="Password"
        type="password"
        placeholder="Min. 8 characters"
        required
        autocomplete="new-password"
      />
      <AppInput v-model="phone" label="Phone" placeholder="+60xxxxxxxxx" autocomplete="tel" />

      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>

      <AppButton type="submit" :disabled="submitting" class="w-full">
        {{ submitting ? 'Creating…' : 'Create Student' }}
      </AppButton>
    </form>
  </div>
</template>
