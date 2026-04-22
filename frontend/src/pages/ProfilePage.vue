<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { changePassword } from '@/api/auth'
import { CLASS_VALUES } from '@/utils/classNames'
import type { ClassName } from '@/utils/classNames'
import { refreshFideRating, type UpdateUserBody } from '@/api/users'
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
const className = ref<ClassName | ''>('')
const fideId = ref('')
const mcfId = ref('')
const refreshingFide = ref(false)

function resetForm() {
  name.value = user.value?.name ?? auth.user?.name ?? ''
  phone.value = user.value?.phone ?? ''
  className.value = user.value?.className ?? ''
  fideId.value = user.value?.fideId ?? ''
  mcfId.value = user.value?.mcfId ?? ''
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
    const patch: UpdateUserBody = {}
    if (name.value.trim() !== user.value?.name) patch.name = name.value.trim()
    const trimmedPhone = phone.value.trim() || null
    if (trimmedPhone !== (user.value?.phone ?? null)) patch.phone = trimmedPhone
    const newClass = className.value || null
    if (newClass !== (user.value?.className ?? null)) patch.className = newClass
    const newFideId = fideId.value.trim() || null
    if (newFideId !== (user.value?.fideId ?? null)) patch.fideId = newFideId
    const newMcfId = mcfId.value.trim() || null
    if (newMcfId !== (user.value?.mcfId ?? null)) patch.mcfId = newMcfId

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

async function handleRefreshFide() {
  if (!auth.user?.id || !user.value?.fideId) return
  refreshingFide.value = true
  try {
    const updated = await refreshFideRating(auth.user.id)
    userStore.current = updated
    toastStore.show('FIDE rating refreshed.', 'success')
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    toastStore.show(msg ?? 'Failed to refresh rating.', 'error')
  } finally {
    refreshingFide.value = false
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
        <div class="text-sm text-gray-500">@{{ auth.user?.username }}</div>
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
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Class (optional)</label>
          <select
            v-model="className"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">— Not set —</option>
            <option v-for="c in CLASS_VALUES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <AppInput
          v-model="fideId"
          label="FIDE ID (optional)"
          placeholder="e.g. 12828980"
          autocomplete="off"
          inputmode="numeric"
        />

        <!-- FIDE rating chip (read-only, updates after save or manual refresh) -->
        <div
          v-if="user?.fideId"
          class="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2"
        >
          <div class="text-xs text-indigo-900 min-w-0">
            <p class="font-semibold">FIDE Rating</p>
            <p v-if="user.fideStandardRating || user.fideRapidRating || user.fideBlitzRating" class="mt-0.5">
              <span v-if="user.fideStandardRating">Std {{ user.fideStandardRating }}</span>
              <span v-if="user.fideRapidRating">
                <span v-if="user.fideStandardRating"> · </span>Rapid {{ user.fideRapidRating }}
              </span>
              <span v-if="user.fideBlitzRating">
                <span v-if="user.fideStandardRating || user.fideRapidRating"> · </span>Blitz {{ user.fideBlitzRating }}
              </span>
            </p>
            <p v-else class="mt-0.5 text-indigo-700/70 italic">Not rated yet — tap Refresh.</p>
          </div>
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            :disabled="refreshingFide"
            @click="handleRefreshFide"
          >
            <AppIcon name="calendar" class="h-3 w-3" />
            {{ refreshingFide ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>

        <AppInput
          v-model="mcfId"
          label="MCF ID (optional)"
          placeholder="Malaysian Chess Federation ID"
          autocomplete="off"
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
