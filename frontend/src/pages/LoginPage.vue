<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
  coach: '/login',
}

async function handleSubmit() {
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : undefined
    const home = auth.user ? (ROLE_HOME[auth.user.role] ?? '/login') : '/login'
    router.push(redirect ?? home)
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
      error.value = 'Invalid username or password.'
    } else {
      error.value = 'Something went wrong. Please try again.'
    }
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex flex-col items-center gap-3">
        <img src="@/assets/logo-transparent.png" alt="STF Supreme Chess" class="h-20 w-auto" />
        <h1 class="text-xl font-bold text-gray-900">STF Supreme Chess</h1>
        <p class="text-sm text-gray-500">Sign in to your account</p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <AppInput
          v-model="username"
          label="Username"
          type="text"
          placeholder="Enter your username"
          autocomplete="username"
          required
        />
        <AppInput
          v-model="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
        />

        <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>

        <AppButton type="submit" :disabled="auth.loading" class="w-full mt-2">
          {{ auth.loading ? 'Signing in…' : 'Sign in' }}
        </AppButton>
      </form>
    </div>
  </div>
</template>
