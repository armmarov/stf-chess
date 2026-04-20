<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'
import AppModal from '@/components/AppModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppWhatsAppLink from '@/components/AppWhatsAppLink.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const auth = useAuthStore()
const toastStore = useToastStore()

const id = route.params.id as string
const { confirm } = useConfirm()

const user = computed(() => userStore.current)
const isSelf = computed(() => auth.user?.id === id)

// Deactivate
const togglingActive = ref(false)
const toggleError = ref('')

// Reset password modal
const passwordModalOpen = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const resettingPassword = ref(false)

onMounted(() => userStore.fetchUser(id))

async function toggleActive() {
  if (!user.value) return
  if (isSelf.value && user.value.isActive) {
    toastStore.show('You cannot deactivate your own account.', 'error')
    return
  }
  if (user.value.isActive) {
    const ok = await confirm({
      title: 'Deactivate user?',
      message: "They won't be able to log in until reactivated.",
      confirmLabel: 'Deactivate',
      variant: 'danger',
    })
    if (!ok) return
  }
  togglingActive.value = true
  toggleError.value = ''
  try {
    await userStore.updateUser(id, { isActive: !user.value.isActive })
    toastStore.show(user.value.isActive ? 'User reactivated.' : 'User deactivated.', 'success')
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      toggleError.value = 'Cannot deactivate your own account.'
    } else {
      toggleError.value = 'Failed to update user status.'
    }
  } finally {
    togglingActive.value = false
  }
}

function openPasswordModal() {
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordModalOpen.value = true
}

async function submitPasswordReset() {
  if (newPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.'
    return
  }
  resettingPassword.value = true
  passwordError.value = ''
  try {
    await userStore.setPassword(id, newPassword.value)
    toastStore.show('Password updated.', 'success')
    passwordModalOpen.value = false
  } catch {
    passwordError.value = 'Failed to reset password. Please try again.'
  } finally {
    resettingPassword.value = false
  }
}

const roleBadge: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  teacher: 'bg-blue-100 text-blue-700',
  coach: 'bg-yellow-100 text-yellow-700',
  student: 'bg-green-100 text-green-700',
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/admin/users')"
    >
      ← Back to users
    </button>

    <div v-if="userStore.loading && !user" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="user" class="flex flex-col gap-4">
      <!-- Detail card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between mb-4 gap-3">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
              <AppIcon name="user" class="h-4 w-4 text-indigo-500 shrink-0" />
              <span class="truncate">{{ user.name }}</span>
            </h1>
            <p class="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <AppIcon name="hash" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {{ user.username }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span
              class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium capitalize"
              :class="roleBadge[user.role] ?? 'bg-gray-100 text-gray-600'"
            >
              <AppIcon name="tag" class="h-3 w-3" />
              {{ user.role }}
            </span>
            <span
              class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium"
              :class="user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
            >
              <AppIcon name="check-circle" class="h-3 w-3" />
              {{ user.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>

        <dl class="flex flex-col gap-3 text-sm border-t border-gray-100 pt-4">
          <div v-if="user.phone">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="phone" class="h-3.5 w-3.5" />
              Phone
            </dt>
            <dd class="text-gray-900 mt-0.5">
              <AppWhatsAppLink :phone="user.phone" />
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="calendar" class="h-3.5 w-3.5" />
              Member since
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ new Date(user.createdAt).toLocaleDateString() }}</dd>
          </div>
        </dl>
      </div>

      <!-- Error -->
      <p v-if="toggleError" role="alert" class="text-xs text-red-600 px-1">{{ toggleError }}</p>

      <!-- Actions -->
      <div class="flex flex-col gap-3">
        <AppButton variant="secondary" class="w-full" @click="router.push(`/admin/users/${id}/edit`)">
          Edit
        </AppButton>
        <AppButton
          :variant="user.isActive ? 'danger' : 'secondary'"
          class="w-full"
          :disabled="togglingActive"
          @click="toggleActive"
        >
          {{ togglingActive ? 'Updating…' : user.isActive ? 'Deactivate' : 'Reactivate' }}
        </AppButton>
        <AppButton variant="danger" class="w-full" @click="openPasswordModal">
          Reset Password
        </AppButton>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">User not found.</div>

    <!-- Reset Password Modal -->
    <AppModal title="Reset Password" :open="passwordModalOpen" @close="passwordModalOpen = false">
      <form class="flex flex-col gap-3" @submit.prevent="submitPasswordReset">
        <AppInput
          v-model="newPassword"
          label="New Password"
          type="password"
          placeholder="Min. 8 characters"
          autocomplete="new-password"
        />
        <AppInput
          v-model="confirmPassword"
          label="Confirm Password"
          type="password"
          placeholder="Repeat password"
          autocomplete="new-password"
        />
        <p v-if="passwordError" role="alert" class="text-xs text-red-600">{{ passwordError }}</p>
        <div class="flex gap-2">
          <AppButton type="submit" :disabled="resettingPassword" class="flex-1">
            {{ resettingPassword ? 'Saving…' : 'Update Password' }}
          </AppButton>
          <AppButton
            type="button"
            variant="secondary"
            class="flex-1"
            @click="passwordModalOpen = false"
          >
            Cancel
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
