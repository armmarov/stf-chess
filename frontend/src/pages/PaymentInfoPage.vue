<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AppButton from '@/components/AppButton.vue'
import qrImage from '@/assets/maybank-qr.jpg'

const router = useRouter()
const accountNumber = '1550 9618 3848'

async function copyAccount() {
  try {
    await navigator.clipboard.writeText(accountNumber.replace(/\s/g, ''))
  } catch {
    // Ignore — user can copy manually
  }
}
</script>

<template>
  <div class="max-w-md mx-auto">
    <button
      class="text-indigo-600 text-sm hover:underline mb-3 inline-flex items-center gap-1"
      @click="router.back()"
    >
      ← Back
    </button>

    <h1 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-1.5">
      <AppIcon name="dollar" class="h-5 w-5 text-indigo-600" />
      Payment Info
    </h1>

    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <img
        :src="qrImage"
        alt="Maybank QR — Ammar Bin Abdullah"
        class="w-full"
      />

      <div class="p-5 flex flex-col gap-3 border-t border-gray-100">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide">Bank</p>
          <p class="text-gray-900 mt-0.5">Maybank</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide">Account Number</p>
          <div class="flex items-center gap-2 mt-0.5">
            <code class="text-gray-900 font-mono text-base tracking-wide">{{ accountNumber }}</code>
            <button
              class="text-xs text-indigo-600 hover:underline"
              @click="copyAccount"
            >
              Copy
            </button>
          </div>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide">Account Holder</p>
          <p class="text-gray-900 mt-0.5">Ammar bin Abdullah</p>
        </div>
      </div>
    </div>

    <div class="mt-4 text-xs text-gray-500">
      Scan the QR or transfer to the account above, then upload your receipt on the session page.
    </div>

    <div class="mt-6">
      <AppButton variant="secondary" @click="router.back()">
        ← Back
      </AppButton>
    </div>
  </div>
</template>
