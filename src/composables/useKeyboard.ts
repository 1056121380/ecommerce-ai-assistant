import { onMounted, onUnmounted } from 'vue'

export interface KeyBinding {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: (event: KeyboardEvent) => void
  description?: string
}

export function useKeyboard(bindings: KeyBinding[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const binding of bindings) {
      const ctrlMatch = binding.ctrl === undefined || binding.ctrl === (event.ctrlKey || event.metaKey)
      const shiftMatch = binding.shift === undefined || binding.shift === event.shiftKey
      const altMatch = binding.alt === undefined || binding.alt === event.altKey
      const metaMatch = binding.meta === undefined || binding.meta === event.metaKey

      if (
        event.key.toLowerCase() === binding.key.toLowerCase() &&
        ctrlMatch &&
        shiftMatch &&
        altMatch &&
        metaMatch
      ) {
        event.preventDefault()
        binding.handler(event)
        break
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
