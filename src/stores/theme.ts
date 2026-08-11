import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const media = window.matchMedia('(prefers-color-scheme: dark)')

export const useThemeStore = defineStore(
  'theme',
  () => {
    const mode = ref<ThemeMode>('system')

    function resolve(): 'light' | 'dark' {
      return mode.value === 'system' ? (media.matches ? 'dark' : 'light') : mode.value
    }

    function apply() {
      document.documentElement.dataset.theme = resolve()
    }

    function setMode(next: ThemeMode) {
      mode.value = next
      apply()
    }

    watch(mode, apply)
    media.addEventListener('change', () => {
      if (mode.value === 'system') apply()
    })

    apply()

    return { mode, setMode }
  },
  {
    persist: {
      key: 'rivex-theme',
      pick: ['mode'],
    },
  },
)
