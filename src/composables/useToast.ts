import { reactive } from 'vue'

export interface ToastItem {
  id: number
  message: string
  variant: 'success' | 'error' | 'info'
}

const toasts = reactive<ToastItem[]>([])
let nextId = 1

function push(message: string, variant: ToastItem['variant'], duration = 3500) {
  const id = nextId++
  toasts.push({ id, message, variant })
  setTimeout(() => dismiss(id), duration)
}

function dismiss(id: number) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) toasts.splice(index, 1)
}

export function useToast() {
  return {
    toasts,
    success: (message: string) => push(message, 'success'),
    error: (message: string) => push(message, 'error'),
    info: (message: string) => push(message, 'info'),
    dismiss,
  }
}
