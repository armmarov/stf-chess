<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { changePassword } from '@/api/auth'
import AppInput from '@/components/AppInput.vue'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()
const userStore = useUserStore()
const toastStore = useToastStore()

const user = computed(() => userStore.current)
const saving = ref(false)

const name = ref('')
const phone = ref('')

function resetForm() {
  name.value = user.value?.name ?? auth.user?.name ?? ''
  phone.value = user.value?.phone ?? ''
}

watch(user, (u) => {
  if (u) resetForm()
}, { immediate: true })

onMounted(() => {
  if (auth.user) userStore.fetchUser(auth.user.id)
})

const roleBadge: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  teacher: 'bg-blue-100 text-blue-700',
  coach: 'bg-yellow-100 text-yellow-700',
  student: 'bg-green-100 text-green-700',
}

async function handleSave() {
  if (!auth.user || !name.value.trim()) return
  saving.value = true
  try {
    const patch: { name?: string; phone?: string | null } = {}
    if (name.value.trim() !== user.value?.name) patch.name = name.value.trim()
    const trimmedPhone = phone.value.trim() || null
    if (trimmedPhone !== (user.value?.phone ?? null)) patch.phone = trimmedPhone

    if (Object.keys(patch).length > 0) {
      await userStore.updateUser(auth.user.id, patch)
      await auth.fetchMe()
    }
    toastStore.show('Profile updated.', 'success')
  } catch {
    toastStore.show('Failed to update profile.', 'error')
  } finally {
    saving.value = false
  }
}

// Change password
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const changingPassword = ref(false)

function resetPasswordForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
}

async function handleChangePassword() {
  passwordError.value = ''
  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.'
    return
  }
  changingPassword.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    toastStore.show('Password updated.', 'success')
    resetPasswordForm()
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    toastStore.show(msg ?? 'Failed to update password.', 'error')
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto flex flex-col gap-4">
    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
      <AppIcon name="user-circle" class="h-5 w-5 text-indigo-600" />
      My Profile
    </h1>

    <!-- Profile card -->
    <div v-if="userStore.loading && !user" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
      <!-- Read-only: username + role -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 text-sm text-gray-500">
          <AppIcon name="hash" class="h-4 w-4 shrink-0 text-gray-400" />
          <span>{{ auth.user?.username }}</span>
        </div>
        <span
          class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium capitalize"
          :class="roleBadge[auth.user?.role ?? ''] ?? 'bg-gray-100 text-gray-600'"
        >
          <AppIcon name="tag" class="h-3 w-3" />
          {{ auth.user?.role }}
        </span>
      </div>

      <!-- Editable fields -->
      <div class="border-t border-gray-100 pt-4 flex flex-col gap-3">
        <AppInput
          v-model="name"
          label="Name"
          placeholder="Your full name"
          autocomplete="name"
        />
        <AppInput
          v-model="phone"
          label="Phone (optional)"
          placeholder="+60123456789"
          autocomplete="tel"
          type="tel"
        />
      </div>

      <div class="flex gap-2 pt-1">
        <AppButton :disabled="saving || !name.trim()" class="flex-1" @click="handleSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </AppButton>
        <AppButton variant="secondary" class="flex-1" :disabled="saving" @click="resetForm">
          Cancel
        </AppButton>
      </div>
    </div>

    <!-- Change Password card -->
    <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
        <AppIcon name="settings" class="h-4 w-4 text-gray-400" />
        Change Password
      </h2>

      <AppInput
        v-model="currentPassword"
        label="Current Password"
        type="password"
        autocomplete="current-password"
        placeholder="Enter current password"
      />
      <AppInput
        v-model="newPassword"
        label="New Password"
        type="password"
        autocomplete="new-password"
        placeholder="Min. 8 characters"
      />
      <AppInput
        v-model="confirmPassword"
        label="Confirm New Password"
        type="password"
        autocomplete="new-password"
        placeholder="Repeat new password"
      />

      <p v-if="passwordError" role="alert" class="text-xs text-red-600">{{ passwordError }}</p>

      <AppButton
        :disabled="changingPassword || !currentPassword || !newPassword || !confirmPassword"
        @click="handleChangePassword"
      >
        {{ changingPassword ? 'Updating…' : 'Update Password' }}
      </AppButton>
    </div>
  </div>
</template>
