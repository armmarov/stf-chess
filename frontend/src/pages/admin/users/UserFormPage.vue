<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import type { Role } from '@/stores/authStore'
import type { UpdateUserBody } from '@/api/users'
import { CLASS_VALUES } from '@/utils/classNames'
import type { ClassName } from '@/utils/classNames'
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
const className = ref<ClassName | ''>('')
const isActive = ref(true)

const originalUsername = ref('')
const submitting = ref(false)
const error = ref('')
const usernameError = ref('')

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
        originalUsername.value = u.username
        role.value = u.role
        phone.value = u.phone ?? ''
        className.value = u.className ?? ''
        isActive.value = u.isActive
      }
    } catch {
      toastStore.show('Failed to load user.', 'error')
      router.push('/admin/users')
    }
  }
})

watch(username, () => {
  if (usernameError.value) usernameError.value = ''
})

const USERNAME_RE = /^[a-z0-9_]+$/

function validate(): string {
  if (!name.value.trim()) return 'Name is required.'
  const u = username.value.trim()
  if (!u) return 'Username is required.'
  if (u.length < 3 || u.length > 32) return 'Username must be 3–32 characters.'
  if (!USERNAME_RE.test(u)) return 'Username may only contain lowercase letters, digits, or underscores.'
  if (!isEdit.value && password.value.length < 8) return 'Password must be at least 8 characters.'
  return ''
}

async function submit() {
  error.value = validate()
  usernameError.value = ''
  if (error.value) return

  submitting.value = true
  try {
    if (isEdit.value && id) {
      const u = userStore.current
      const patch: UpdateUserBody = {}
      if (name.value.trim() !== u?.name) patch.name = name.value.trim()
      if (username.value.trim() !== originalUsername.value) patch.username = username.value.trim()
      const trimmedPhone = phone.value.trim() || null
      if (trimmedPhone !== (u?.phone ?? null)) patch.phone = trimmedPhone
      const newClass = className.value || null
      if (newClass !== (u?.className ?? null)) patch.className = newClass
      if (isActive.value !== u?.isActive) patch.isActive = isActive.value
      await userStore.updateUser(id, patch)
      toastStore.show('User updated.', 'success')
      router.push(`/admin/users/${id}`)
    } else {
      const user = await userStore.createUser({
        name: name.value.trim(),
        username: username.value.trim(),
        password: password.value,
        role: role.value,
        phone: phone.value.trim() || undefined,
        className: className.value || undefined,
      })
      toastStore.show('User created.', 'success')
      router.push(`/admin/users/${user.id}`)
    }
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    if (status === 409) {
      usernameError.value = msg ?? 'Username already taken.'
    } else {
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

      <!-- Username (both modes) -->
      <div class="flex flex-col gap-1">
        <AppInput
          v-model="username"
          label="Username"
          placeholder="e.g. john_doe"
          required
          :autocomplete="isEdit ? 'off' : 'username'"
          :error="usernameError"
        />
        <p v-if="isEdit" class="text-xs text-gray-400">
          Changing the username does not log the user out.
        </p>
      </div>

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

      <!-- Class -->
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
