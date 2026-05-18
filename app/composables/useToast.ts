import { reactive } from 'vue'

export type ToastColor = 'primary' | 'error' | 'warning' | 'success' | 'info' | 'neutral'

export interface ToastEntry {
  id: number
  title: string
  description?: string
  color: ToastColor
  duration: number
}

interface ToastInput {
  title: string
  description?: string
  color?: ToastColor | string
  duration?: number
}

interface ToastStore {
  items: ToastEntry[]
}

let counter = 0
const store: ToastStore = reactive({ items: [] })
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function normalizeColor(color: string | undefined): ToastColor {
  switch (color) {
    case 'error':
    case 'warning':
    case 'success':
    case 'info':
    case 'neutral':
    case 'primary': {
      return color
    }
    default: {
      return 'primary'
    }
  }
}

function add(input: ToastInput): ToastEntry {
  counter += 1
  const entry: ToastEntry = {
    id: counter,
    title: input.title,
    description: input.description,
    color: normalizeColor(input.color),
    duration: input.duration ?? 4500,
  }
  store.items = [...store.items, entry]
  if (entry.duration > 0 && import.meta.client) {
    const timer = setTimeout(remove, entry.duration, entry.id)
    timers.set(entry.id, timer)
  }
  return entry
}

function remove(id: number): void {
  store.items = store.items.filter(item => item.id !== id)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

function clear(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
  store.items = []
}

export function useToast() {
  return { add, remove, clear }
}

export function useToastStore(): ToastStore {
  return store
}
