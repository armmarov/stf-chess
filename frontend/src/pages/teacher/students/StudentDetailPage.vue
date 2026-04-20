<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppWhatsAppLink from '@/components/AppWhatsAppLink.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toastStore = useToastStore()
const { confirm } = useConfirm()

const id = route.params.id as string
const student = computed(() => userStore.current)

const togglingActive = ref(false)
const toggleError = ref('')

onMounted(() => userStore.fetchUser(id))

async function toggleActive() {
  if (!student.value) return
  if (student.value.isActive) {
    const ok = await confirm({
      title: 'Deactivate student?',
      message: "They won't be able to log in until reactivated.",
      confirmLabel: 'Deactivate',
      variant: 'danger',
    })
    if (!ok) return
  }
  togglingActive.value = true
  toggleError.value = ''
  try {
    await userStore.updateUser(id, { isActive: !student.value.isActive })
    toastStore.show(student.value.isActive ? 'Student deactivated.' : 'Student reactivated.', 'success')
  } catch {
    toggleError.value = 'Failed to update student status.'
  } finally {
    togglingActive.value = false
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

    <div v-if="userStore.loading && !student" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="student" class="flex flex-col gap-4">
      <!-- Detail card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between mb-4 gap-3">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
              <AppIcon name="user" class="h-4 w-4 text-indigo-500 shrink-0" />
              <span class="truncate">{{ student.name }}</span>
            </h1>
            <p class="text-sm text-gray-500 mt-0.5">@{{ student.username }}</p>
          </div>
          <span
            class="inline-flex items-center gap-0.5 rounded-full text-xs px-2 py-0.5 font-medium shrink-0"
            :class="student.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            <AppIcon name="check-circle" class="h-3 w-3" />
            {{ student.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>

        <dl class="flex flex-col gap-3 text-sm border-t border-gray-100 pt-4">
          <div v-if="student.phone">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="phone" class="h-3.5 w-3.5" />
              Phone
            </dt>
            <dd class="text-gray-900 mt-0.5">
              <AppWhatsAppLink :phone="student.phone" />
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="hash" class="h-3.5 w-3.5" />
              Class
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ student.className ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="calendar" class="h-3.5 w-3.5" />
              Member since
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ new Date(student.createdAt).toLocaleDateString() }}</dd>
          </div>
        </dl>
      </div>

      <!-- Error -->
      <p v-if="toggleError" role="alert" class="text-xs text-red-600 px-1">{{ toggleError }}</p>

      <!-- Actions -->
      <div class="flex flex-col gap-3">
        <AppButton variant="secondary" class="w-full" @click="router.push(`/teacher/students/${id}/edit`)">
          Edit
        </AppButton>
        <AppButton
          :variant="student.isActive ? 'danger' : 'secondary'"
          class="w-full"
          :disabled="togglingActive"
          @click="toggleActive"
        >
          {{ togglingActive ? 'Updating…' : student.isActive ? 'Deactivate' : 'Reactivate' }}
        </AppButton>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Student not found.</div>
  </div>
</template>
