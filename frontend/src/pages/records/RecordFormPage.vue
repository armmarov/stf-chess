<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecordStore } from '@/stores/recordStore'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { placementLabel, LEVEL_LABELS, CATEGORY_LABELS } from '@/utils/records'
import { recordImageUrl, type RecordLevel, type RecordCategory } from '@/api/records'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'

const route = useRoute()
const router = useRouter()
const recordStore = useRecordStore()
const auth = useAuthStore()
const userStore = useUserStore()
const toastStore = useToastStore()

const isEdit = computed(() => !!route.params.id)
const recordId = computed(() => route.params.id as string | undefined)

const isStudent = computed(() => auth.user?.role === 'student')

// Form fields
const studentId = ref<string>(isStudent.value ? (auth.user?.id ?? '') : '')
const competitionName = ref('')
const competitionDate = ref('')
const level = ref<RecordLevel>('sekolah')
const category = ref<RecordCategory>('u18')
// null string represents "Participation"
const placementRaw = ref<string>('null')
const pajsk = ref(false)
const fideRated = ref(false)
const mcfRated = ref(false)

const submitting = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)

// Image upload state
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const removeImageFlag = ref(false)
const hasExistingImage = computed(() => recordStore.current?.hasImage === true && !removeImageFlag.value && !imageFile.value)
const imageInputRef = ref<HTMLInputElement | null>(null)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const levels: RecordLevel[] = ['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa']
const categories: RecordCategory[] = ['u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u21', 'open']

// 31 placement options: null (Participation) then 1..30
const placementOptions = [
  { value: 'null', label: placementLabel(null) },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: String(i + 1),
    label: placementLabel(i + 1),
  })),
]

const students = computed(() => userStore.listCache[userStore.cacheKey({ role: 'student' })] ?? [])

const canDelete = computed(() => {
  if (!isEdit.value || !recordStore.current) return false
  const role = auth.user?.role
  if (role === 'admin' || role === 'teacher') return true
  return recordStore.current.createdBy.id === auth.user?.id
})

const isFormValid = computed(() =>
  competitionName.value.trim() !== '' &&
  competitionDate.value !== '' &&
  (isStudent.value || studentId.value !== '')
)

onMounted(async () => {
  // Always load students list (needed for selector when role != student)
  if (!isStudent.value) {
    await userStore.fetchUsers({ role: 'student' })
  }

  if (isEdit.value && recordId.value) {
    await recordStore.fetchOne(recordId.value)
    const rec = recordStore.current
    if (!rec) {
      toastStore.show('Record not found.', 'error')
      router.replace('/records')
      return
    }

    // Auth check: can the current user edit this record?
    const role = auth.user?.role
    const isAllowed =
      role === 'admin' ||
      role === 'teacher' ||
      rec.createdBy.id === auth.user?.id

    if (!isAllowed) {
      toastStore.show('Not allowed.', 'error')
      router.replace('/records')
      return
    }

    // Populate form
    studentId.value = rec.student.id
    competitionName.value = rec.competitionName
    competitionDate.value = rec.competitionDate.slice(0, 10)
    level.value = rec.level
    category.value = rec.category
    placementRaw.value = rec.placement === null ? 'null' : String(rec.placement)
    pajsk.value = rec.pajsk
    fideRated.value = rec.fideRated
    mcfRated.value = rec.mcfRated
  }
})

function onImagePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return
  if (file.size > MAX_IMAGE_BYTES) {
    toastStore.show('Image exceeds 5 MB limit.', 'error')
    input.value = ''
    return
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toastStore.show('Image must be JPEG, PNG, or WebP.', 'error')
    input.value = ''
    return
  }
  imageFile.value = file
  removeImageFlag.value = false
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = URL.createObjectURL(file)
}

function clearPickedImage() {
  imageFile.value = null
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = null
  }
  if (imageInputRef.value) imageInputRef.value.value = ''
}

function removeExistingImage() {
  removeImageFlag.value = true
  clearPickedImage()
}

async function handleSubmit() {
  if (!isFormValid.value) return
  submitting.value = true
  try {
    const placement = placementRaw.value === 'null' ? null : Number(placementRaw.value)
    if (isEdit.value && recordId.value) {
      await recordStore.update(recordId.value, {
        competitionName: competitionName.value.trim(),
        competitionDate: competitionDate.value,
        level: level.value,
        category: category.value,
        placement,
        pajsk: pajsk.value,
        fideRated: fideRated.value,
        mcfRated: mcfRated.value,
        image: imageFile.value ?? undefined,
        removeImage: removeImageFlag.value,
      })
      toastStore.show('Record updated.', 'success')
    } else {
      await recordStore.create({
        studentId: studentId.value,
        competitionName: competitionName.value.trim(),
        competitionDate: competitionDate.value,
        level: level.value,
        category: category.value,
        placement,
        pajsk: pajsk.value,
        fideRated: fideRated.value,
        mcfRated: mcfRated.value,
        image: imageFile.value ?? undefined,
      })
      toastStore.show('Record created.', 'success')
    }
    router.push('/records')
  } catch {
    toastStore.show('Failed to save record.', 'error')
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!recordId.value) return
  deleting.value = true
  try {
    await recordStore.remove(recordId.value)
    toastStore.show('Record deleted.', 'success')
    router.push('/records')
  } catch {
    toastStore.show('Failed to delete record.', 'error')
  } finally {
    deleting.value = false
    showDeleteModal.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-4 inline-block"
      @click="router.push('/records')"
    >
      &larr; Back to records
    </button>

    <h1 class="text-lg font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
      <AppIcon name="award" class="h-5 w-5 text-indigo-600" />
      {{ isEdit ? 'Edit Record' : 'New Record' }}
    </h1>

    <div v-if="recordStore.loading && isEdit && !recordStore.current" class="text-center py-10 text-gray-400 text-sm">
      Loading…
    </div>

    <div v-else class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">

      <!-- Student selector: disabled + pre-filled for students -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">
          Student <span class="text-red-500">*</span>
        </label>
        <select
          v-model="studentId"
          :disabled="isStudent"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
        >
          <option v-if="!isStudent" value="" disabled>Select student</option>
          <option v-if="isStudent" :value="auth.user?.id">{{ auth.user?.name }}</option>
          <template v-if="!isStudent">
            <option v-for="s in students" :key="s.id" :value="s.id">
              {{ s.name }}{{ s.className ? ` (${s.className})` : '' }}
            </option>
          </template>
        </select>
      </div>

      <!-- Competition name -->
      <AppInput
        v-model="competitionName"
        label="Competition Name"
        placeholder="e.g. MSSM Chess Championship 2025"
        required
      />

      <!-- Date -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">
          Competition Date <span class="text-red-500">*</span>
        </label>
        <input
          v-model="competitionDate"
          type="date"
          required
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <!-- Level + Category in a grid -->
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Level <span class="text-red-500">*</span></label>
          <select
            v-model="level"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option v-for="l in levels" :key="l" :value="l">{{ LEVEL_LABELS[l] }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Category <span class="text-red-500">*</span></label>
          <select
            v-model="category"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option v-for="c in categories" :key="c" :value="c">{{ CATEGORY_LABELS[c] }}</option>
          </select>
        </div>
      </div>

      <!-- Placement -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Placement <span class="text-red-500">*</span></label>
        <select
          v-model="placementRaw"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option v-for="opt in placementOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Checkboxes -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Rating / Recognition</label>
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            v-model="pajsk"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          PAJSK (counts towards co-curriculum marks)
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            v-model="fideRated"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          FIDE rated
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            v-model="mcfRated"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          MCF rated
        </label>
      </div>

      <!-- Image upload -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Image (optional)</label>

        <!-- Existing image in edit mode -->
        <div v-if="hasExistingImage && recordId" class="flex items-start gap-3">
          <img
            :src="recordImageUrl(recordId)"
            class="w-24 h-24 object-cover rounded border border-gray-200"
            alt="Current record image"
          />
          <button
            type="button"
            class="text-xs text-red-600 hover:underline"
            @click="removeExistingImage"
          >
            Remove image
          </button>
        </div>

        <!-- Preview for a newly picked image -->
        <div v-else-if="imagePreviewUrl" class="flex items-start gap-3">
          <img
            :src="imagePreviewUrl"
            class="w-24 h-24 object-cover rounded border border-gray-200"
            alt="Selected image preview"
          />
          <button type="button" class="text-xs text-red-600 hover:underline" @click="clearPickedImage">
            Clear
          </button>
        </div>

        <input
          ref="imageInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="block text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          @change="onImagePicked"
        />
        <p class="text-xs text-gray-400">JPEG / PNG / WebP, up to 5 MB</p>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 pt-1">
        <AppButton
          class="flex-1"
          :disabled="submitting || !isFormValid"
          @click="handleSubmit"
        >
          {{ submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Record' }}
        </AppButton>
        <AppButton
          variant="secondary"
          class="flex-1"
          :disabled="submitting"
          @click="router.push('/records')"
        >
          Cancel
        </AppButton>
      </div>

      <!-- Delete button — only visible to creator / teacher / admin in edit mode -->
      <div v-if="isEdit && canDelete" class="border-t border-gray-100 pt-3">
        <AppButton
          variant="danger"
          class="w-full"
          :disabled="deleting"
          @click="showDeleteModal = true"
        >
          <AppIcon name="trash" class="h-4 w-4 mr-1.5" />
          Delete Record
        </AppButton>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <AppModal title="Delete Record" :open="showDeleteModal" @close="showDeleteModal = false">
      <p class="text-sm text-gray-600">
        Are you sure you want to delete this competition record? This action cannot be undone.
      </p>
      <div class="flex gap-3 pt-1">
        <AppButton variant="danger" class="flex-1" :loading="deleting" @click="handleDelete">
          Delete
        </AppButton>
        <AppButton variant="secondary" class="flex-1" :disabled="deleting" @click="showDeleteModal = false">
          Cancel
        </AppButton>
      </div>
    </AppModal>
  </div>
</template>
