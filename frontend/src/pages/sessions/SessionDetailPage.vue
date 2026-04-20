<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useAttendanceStore } from '@/stores/attendanceStore'
import { usePaymentStore } from '@/stores/paymentStore'
import { useConfigStore } from '@/stores/configStore'
import { useToastStore } from '@/stores/toastStore'
import { useConfirm } from '@/composables/useConfirm'
import { getReceiptFullUrl } from '@/api/payments'
import { toHHMM, formatDate, sessionSerial } from '@/utils/format'
import AppButton from '@/components/AppButton.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const auth = useAuthStore()
const attendanceStore = useAttendanceStore()
const paymentStore = usePaymentStore()
const configStore = useConfigStore()
const toastStore = useToastStore()

const id = route.params.id as string
const { confirm } = useConfirm()
const cancelling = ref(false)
const cancelError = ref('')
const preAttendToggling = ref(false)

const isStudent = computed(() => auth.user?.role === 'student')
const canManage = computed(() =>
  auth.user?.role === 'admin' || auth.user?.role === 'teacher',
)

const session = computed(() => sessionStore.current)

// ── Pre-attendance ────────────────────────────────────────────────────────────

const preAttended = computed(() => {
  if (id in attendanceStore.preAttendanceBySession) {
    return attendanceStore.preAttendanceBySession[id]
  }
  return session.value?.myPreAttended ?? false
})

const canPreAttend = computed(() => {
  if (!session.value || session.value.isCancelled) return false
  const cutoffMs = new Date(session.value.startTime).getTime() - 10 * 60 * 1000
  return Date.now() < cutoffMs
})

const preAttendCutoffLabel = computed(() => {
  if (!session.value) return ''
  const cutoff = new Date(new Date(session.value.startTime).getTime() - 10 * 60 * 1000)
  return cutoff.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
})

async function togglePreAttend() {
  if (preAttendToggling.value) return
  preAttendToggling.value = true
  try {
    await attendanceStore.togglePreAttendance(id, !preAttended.value)
  } catch {
    toastStore.show('Could not update pre-attendance. Please try again.', 'error')
  } finally {
    preAttendToggling.value = false
  }
}

// ── Payment section (student only) ───────────────────────────────────────────

const sessionPayments = computed(() =>
  paymentStore.listCache[paymentStore.cacheKey({ sessionId: id })] ?? [],
)
const latestPayment = computed(() => sessionPayments.value[0] ?? null)

const myAttended = computed(() => session.value?.myAttended ?? false)
const myPaidCash = computed(() => session.value?.myPaidCash ?? false)

type PaymentState =
  | 'not-attended'
  | 'cash-paid'
  | 'online-approved'
  | 'online-pending'
  | 'online-rejected'
  | 'upload'

const paymentState = computed((): PaymentState | null => {
  if (!isStudent.value || session.value?.isCancelled) return null
  if (!myAttended.value && !myPaidCash.value && !latestPayment.value) return 'not-attended'
  if (myPaidCash.value) return 'cash-paid'
  if (latestPayment.value?.status === 'approved') return 'online-approved'
  if (latestPayment.value?.status === 'pending') return 'online-pending'
  if (latestPayment.value?.status === 'rejected') return 'online-rejected'
  return 'upload'
})

const paymentFile = ref<File | null>(null)
const paymentPreviewUrl = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref('')

function onPaymentFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0] ?? null
  paymentFile.value = picked
  if (paymentPreviewUrl.value) {
    URL.revokeObjectURL(paymentPreviewUrl.value)
    paymentPreviewUrl.value = null
  }
  if (picked?.type.startsWith('image/')) {
    paymentPreviewUrl.value = URL.createObjectURL(picked)
  }
}

async function submitPayment() {
  if (!paymentFile.value) {
    uploadError.value = 'Please choose a file.'
    return
  }
  const allowed = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowed.includes(paymentFile.value.type)) {
    uploadError.value = 'Only JPG, PNG, or PDF files are accepted.'
    return
  }
  if (paymentFile.value.size > 5 * 1024 * 1024) {
    uploadError.value = 'File must be 5 MB or less.'
    return
  }
  uploading.value = true
  uploadError.value = ''
  try {
    await paymentStore.uploadPayment(id, paymentFile.value)
    await paymentStore.fetchPayments({ sessionId: id })
    paymentFile.value = null
    if (paymentPreviewUrl.value) {
      URL.revokeObjectURL(paymentPreviewUrl.value)
      paymentPreviewUrl.value = null
    }
    toastStore.show('Receipt uploaded.', 'success')
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    uploadError.value = msg ?? 'Upload failed. Please try again.'
  } finally {
    uploading.value = false
  }
}

function openReceipt() {
  if (latestPayment.value) {
    window.open(getReceiptFullUrl(latestPayment.value.receiptUrl), '_blank')
  }
}

// ── Session cancel ────────────────────────────────────────────────────────────

async function cancelSession() {
  const ok = await confirm({
    title: 'Cancel this session?',
    message: 'This cannot be undone. Students will be notified (future phase).',
    confirmLabel: 'Cancel Session',
    variant: 'danger',
  })
  if (!ok) return
  cancelling.value = true
  cancelError.value = ''
  try {
    await sessionStore.cancelSession(id)
  } catch {
    cancelError.value = 'Failed to cancel session. Please try again.'
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  const fetches: Promise<unknown>[] = [sessionStore.fetchSession(id)]
  if (isStudent.value) {
    fetches.push(paymentStore.fetchPayments({ sessionId: id }))
    fetches.push(configStore.fetchFee())
  }
  await Promise.all(fetches)
})

onUnmounted(() => {
  if (paymentPreviewUrl.value) URL.revokeObjectURL(paymentPreviewUrl.value)
})
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/sessions')"
    >
      ← Back to sessions
    </button>

    <div v-if="sessionStore.loading && !session" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else-if="session" class="flex flex-col gap-4">
      <!-- Main card -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
              <AppIcon name="calendar" class="h-4 w-4 text-indigo-500 shrink-0" />
              {{ formatDate(session.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
            </h1>
            <p class="text-sm text-gray-600 mt-0.5 flex items-center gap-1">
              <AppIcon name="clock" class="h-3.5 w-3.5 text-gray-400" />
              {{ toHHMM(session.startTime) }} – {{ toHHMM(session.endTime) }}
            </p>
            <code class="text-xs text-gray-400 font-mono mt-0.5 select-all">{{ sessionSerial(session.id, session.date) }}</code>
          </div>
          <span
            v-if="session.isCancelled"
            class="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium shrink-0"
          >
            Cancelled
          </span>
        </div>

        <!-- Details -->
        <dl class="flex flex-col gap-3 text-sm border-t border-gray-100 pt-4">
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="map-pin" class="h-3.5 w-3.5" />
              Place
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ session.place }}</dd>
          </div>
          <div v-if="session.notes">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="document" class="h-3.5 w-3.5" />
              Notes
            </dt>
            <dd class="text-gray-900 mt-0.5 whitespace-pre-line">{{ session.notes }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="check-circle" class="h-3.5 w-3.5" />
              Pre-Attendance
            </dt>
            <dd class="text-gray-900 mt-0.5">
              <template v-if="isStudent">
                {{ preAttended ? "You've confirmed" : 'Not confirmed yet' }}
              </template>
              <template v-else>
                {{ session._count.preAttendances }} student(s) confirmed
              </template>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="check-circle" class="h-3.5 w-3.5" />
              Present
            </dt>
            <dd class="text-gray-900 mt-0.5">
              <template v-if="isStudent">
                {{ myAttended ? 'Present' : 'Absent' }}
              </template>
              <template v-else>
                {{ session.presentCount ?? 0 }} student(s) marked present
              </template>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="dollar" class="h-3.5 w-3.5" />
              Paid
            </dt>
            <dd class="text-gray-900 mt-0.5">
              <template v-if="isStudent">
                {{ (myPaidCash || latestPayment?.status === 'approved') ? 'Paid' : 'Not paid yet' }}
              </template>
              <template v-else-if="(session.presentCount ?? 0) === 0">
                — (no one marked present yet)
              </template>
              <template v-else>
                {{ session.paidCashCount ?? 0 }} by cash · {{ session.paidOnlineCount ?? 0 }} online · {{ session.unpaidCount ?? 0 }} not paid yet
              </template>
            </dd>
          </div>
          <div v-if="session.createdBy">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="user-circle" class="h-3.5 w-3.5" />
              Created by
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ session.createdBy.name }}</dd>
          </div>
          <div v-if="session.isCancelled && session.cancelledBy">
            <dt class="text-xs text-gray-500 uppercase tracking-wide inline-flex items-center gap-1.5">
              <AppIcon name="user-circle" class="h-3.5 w-3.5" />
              Cancelled by
            </dt>
            <dd class="text-gray-900 mt-0.5">{{ session.cancelledBy.name }}</dd>
          </div>
        </dl>
      </div>

      <!-- Student: Pre-attendance toggle -->
      <div v-if="isStudent" class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900">
              {{ preAttended ? 'You are attending' : 'Will you attend?' }}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">
              <template v-if="session.isCancelled">Session is cancelled.</template>
              <template v-else-if="canPreAttend">
                Pre-attendance closes at {{ preAttendCutoffLabel }}.
              </template>
              <template v-else>Pre-attendance is closed (10 min before start).</template>
            </p>
          </div>
          <button
            :disabled="!canPreAttend || preAttendToggling"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="preAttended ? 'bg-indigo-600' : 'bg-gray-200'"
            :aria-checked="preAttended"
            role="switch"
            :aria-label="preAttended ? 'Cancel pre-attendance' : 'Confirm attendance'"
            @click="togglePreAttend"
          >
            <span
              class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
              :class="preAttended ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>

      <!-- Student: Payment section (hidden if cancelled or paymentState is null) -->
      <div v-if="paymentState !== null" class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-900 mb-3">Payment</p>

        <!-- State 1: not attended yet -->
        <template v-if="paymentState === 'not-attended'">
          <p class="text-xs text-gray-400">
            Payment will be available once your teacher marks attendance.
          </p>
        </template>

        <!-- State 2: cash paid -->
        <template v-else-if="paymentState === 'cash-paid'">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Status
              </span>
              <span class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium">Completed</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Method
              </span>
              <span class="inline-block rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5 font-medium">Cash</span>
            </div>
            <p v-if="configStore.fee !== null" class="text-xs text-gray-500 mt-1">
              Amount: <span class="font-semibold text-gray-900">RM {{ configStore.fee.toFixed(2) }}</span>
            </p>
          </div>
        </template>

        <!-- State 3: online approved -->
        <template v-else-if="paymentState === 'online-approved'">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Status
              </span>
              <span class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium">Completed</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Method
              </span>
              <span class="inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 font-medium">Online</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Amount: <span class="font-semibold text-gray-900">RM {{ parseFloat(latestPayment!.amount).toFixed(2) }}</span>
              <span v-if="latestPayment!.reviewedAt"> · {{ new Date(latestPayment!.reviewedAt).toLocaleDateString() }}</span>
            </p>
            <button class="text-xs text-indigo-600 hover:underline self-start mt-1" @click="openReceipt">
              View receipt
            </button>
          </div>
        </template>

        <!-- State 4: online pending -->
        <template v-else-if="paymentState === 'online-pending'">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Status
              </span>
              <span class="inline-block rounded-full bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 font-medium">Pending</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Method
              </span>
              <span class="inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 font-medium">Online</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              RM {{ parseFloat(latestPayment!.amount).toFixed(2) }} · uploaded {{ new Date(latestPayment!.uploadedAt).toLocaleDateString() }}
            </p>
            <button class="text-xs text-indigo-600 hover:underline self-start" @click="openReceipt">
              View receipt
            </button>
          </div>
        </template>

        <!-- State 5: online rejected → show note + re-upload form -->
        <template v-else-if="paymentState === 'online-rejected'">
          <div class="flex flex-col gap-2 mb-3">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Status
              </span>
              <span class="inline-block rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium">Rejected</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                <AppIcon name="tag" class="h-3.5 w-3.5" />Method
              </span>
              <span class="inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 font-medium">Online</span>
            </div>
          </div>
          <div v-if="latestPayment!.note" class="rounded bg-red-50 border border-red-100 p-2 text-xs text-red-700 mb-3">
            Reason: {{ latestPayment!.note }}
          </div>
          <div v-if="configStore.fee !== null" class="text-xs text-gray-500 mb-3">
            Session fee: <span class="font-semibold text-gray-900">RM {{ configStore.fee.toFixed(2) }}</span>
          </div>
          <div class="flex flex-col gap-3">
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              class="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              @change="onPaymentFileChange"
            />
            <div v-if="paymentPreviewUrl" class="rounded-lg overflow-hidden border border-gray-200">
              <img :src="paymentPreviewUrl" alt="Receipt preview" class="w-full max-h-48 object-contain bg-gray-50" />
            </div>
            <div v-else-if="paymentFile && paymentFile.type === 'application/pdf'" class="text-xs text-gray-400 italic">
              PDF selected.
            </div>
            <p v-if="uploadError" role="alert" class="text-xs text-red-600">{{ uploadError }}</p>
            <AppButton :disabled="uploading || !paymentFile" class="w-full" @click="submitPayment">
              {{ uploading ? 'Uploading…' : 'Upload Receipt' }}
            </AppButton>
          </div>
        </template>

        <!-- State 6: attended, no payment yet → upload form -->
        <template v-else-if="paymentState === 'upload'">
          <div v-if="configStore.fee !== null" class="text-xs text-gray-500 mb-3">
            Session fee: <span class="font-semibold text-gray-900">RM {{ configStore.fee.toFixed(2) }}</span>
          </div>
          <div class="flex flex-col gap-3">
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              class="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              @change="onPaymentFileChange"
            />
            <div v-if="paymentPreviewUrl" class="rounded-lg overflow-hidden border border-gray-200">
              <img :src="paymentPreviewUrl" alt="Receipt preview" class="w-full max-h-48 object-contain bg-gray-50" />
            </div>
            <div v-else-if="paymentFile && paymentFile.type === 'application/pdf'" class="text-xs text-gray-400 italic">
              PDF selected.
            </div>
            <p v-if="uploadError" role="alert" class="text-xs text-red-600">{{ uploadError }}</p>
            <AppButton :disabled="uploading || !paymentFile" class="w-full" @click="submitPayment">
              {{ uploading ? 'Uploading…' : 'Upload Receipt' }}
            </AppButton>
          </div>
        </template>
      </div>

      <!-- Admin/teacher actions -->
      <div v-if="canManage" class="flex flex-col gap-3">
        <AppButton
          variant="secondary"
          class="w-full"
          @click="router.push(`/sessions/${id}/attendance`)"
        >
          Mark Attendance
        </AppButton>

        <div v-if="!session.isCancelled" class="flex gap-3">
          <AppButton @click="router.push(`/sessions/${id}/edit`)">Edit</AppButton>
          <AppButton variant="danger" :disabled="cancelling" @click="cancelSession">
            {{ cancelling ? 'Cancelling…' : 'Cancel Session' }}
          </AppButton>
        </div>
        <p v-if="cancelError" role="alert" class="text-xs text-red-600 mt-1">{{ cancelError }}</p>
      </div>
    </div>

    <div v-else class="text-center py-10 text-gray-400 text-sm">Session not found.</div>
  </div>
</template>
