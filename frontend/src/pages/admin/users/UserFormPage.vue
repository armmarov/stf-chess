<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import type { Role } from '@/stores/authStore'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()

const id = route.params.id as string | undefined
const isEdit = computed(() => !!id)

// Form fields
const name = ref('')
const username = ref('')
const password = ref('')
const role = ref<Role>('student')
const phone = ref('')
const isActive = ref(true)

const submitting = ref(false)
const error = ref('')

const roles: { label: string; value: Role }[] = [
  { label: 'Student', value: 'student' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Coach', value: 'coach' },
  { label: 'Admin', value: 'admin' },
]

onMounted(async () => {
  if (isEdit.value && id) {
    try {
      await userStore.fetchUser(id)
      const u = userStore.current
      if (u) {
        name.value = u.name
        username.value = u.username
        role.value = u.role
        phone.value = u.phone ?? ''
        isActive.value = u.isActive
      }
    } catch {
      toastStore.show('Failed to load user.', 'error')
      router.push('/admin/users')
    }
  }
})

function validate(): string {
  if (!name.value.trim()) return 'Name is required.'
  if (!isEdit.value && !username.value.trim()) return 'Username is required.'
  if (!isEdit.value && password.value.length < 8) return 'Password must be at least 8 characters.'
  return ''
}

async function submit() {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    if (isEdit.value && id) {
      await userStore.updateUser(id, {
        name: name.value.trim(),
        phone: phone.value.trim() || null,
        isActive: isActive.value,
      })
      toastStore.show('User updated.', 'success')
      router.push(`/admin/users/${id}`)
    } else {
      const user = await userStore.createUser({
        name: name.value.trim(),
        username: username.value.trim(),
        password: password.value,
        role: role.value,
        phone: phone.value.trim() || undefined,
      })
      toastStore.show('User created.', 'success')
      router.push(`/admin/users/${user.id}`)
    }
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
      @click="router.push(isEdit && id ? `/admin/users/${id}` : '/admin/users')"
    >
      ← Back
    </button>

    <h1 class="text-lg font-semibold text-gray-900 mb-4">
      {{ isEdit ? 'Edit User' : 'New User' }}
    </h1>

    <form class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4" @submit.prevent="submit">
      <!-- Name -->
      <AppInput v-model="name" label="Name" placeholder="Full name" required autocomplete="name" />

      <!-- Username (create only) -->
      <AppInput
        v-if="!isEdit"
        v-model="username"
        label="Username"
        placeholder="username"
        required
        autocomplete="username"
      />

      <!-- Role (create only) -->
      <div v-if="!isEdit" class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-700">Role</label>
        <select
          v-model="role"
          class="block w-full rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
      </div>

      <!-- Password (create only) -->
      <AppInput
        v-if="!isEdit"
        v-model="password"
        label="Password"
        type="password"
        placeholder="Min. 8 characters"
        required
        autocomplete="new-password"
      />

      <!-- Phone -->
      <AppInput v-model="phone" label="Phone" placeholder="+60xxxxxxxxx" autocomplete="tel" />

      <!-- Active toggle (edit only) -->
      <div v-if="isEdit" class="flex items-center justify-between">
        <span class="text-sm text-gray-700 font-medium">Active</span>
        <button
          type="button"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          :class="isActive ? 'bg-indigo-600' : 'bg-gray-200'"
          :aria-checked="isActive"
          role="switch"
          @click="isActive = !isActive"
        >
          <span
            class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
            :class="isActive ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>

      <!-- Error -->
      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>

      <AppButton type="submit" :disabled="submitting" class="w-full">
        {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User' }}
      </AppButton>
    </form>
  </div>
</template>
