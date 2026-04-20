import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
}

interface DialogState {
  open: boolean
  opts: ConfirmOptions
  resolve: ((val: boolean) => void) | null
}

// Module-level singleton — all callers share one dialog instance
const state = ref<DialogState>({
  open: false,
  opts: { title: '', message: '' },
  resolve: null,
})

export function useConfirm() {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = { open: true, opts, resolve }
    })
  }

  function respond(answer: boolean) {
    state.value.resolve?.(answer)
    state.value = { open: false, opts: { title: '', message: '' }, resolve: null }
  }

  return { state, confirm, respond }
}
