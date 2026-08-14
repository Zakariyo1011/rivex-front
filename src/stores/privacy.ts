import { defineStore } from 'pinia'
import { ref } from 'vue'
import { privacyApi, type PrivacyOptions, type PrivacySettings } from '@/api/privacy'

/**
 * The signed-in user's privacy settings.
 *
 * Saved per toggle rather than behind a Save button: a privacy control that
 * needs confirming is one a person can believe they set and leave unset. Each
 * change is applied optimistically and rolled back if the server refuses, so
 * the switch never sits in a state the server does not agree with.
 */
export const usePrivacyStore = defineStore('privacy', () => {
  const settings = ref<PrivacySettings | null>(null)
  const options = ref<PrivacyOptions | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function fetch() {
    loading.value = true
    error.value = ''
    try {
      const { data } = await privacyApi.show()
      settings.value = data.data
      options.value = data.options
    } catch {
      error.value = "Sozlamalarni yuklab bo'lmadi."
    } finally {
      loading.value = false
    }
  }

  async function update(patch: Partial<Omit<PrivacySettings, 'follow_needs_approval'>>) {
    if (!settings.value) return

    const previous = { ...settings.value }
    settings.value = { ...settings.value, ...patch }

    saving.value = true
    error.value = ''

    try {
      const { data } = await privacyApi.update(patch)
      // The response carries derived fields the patch could not know about —
      // `follow_needs_approval` follows from profile_visibility.
      settings.value = data.data
      options.value = data.options
    } catch {
      settings.value = previous
      error.value = "O'zgarishni saqlab bo'lmadi."
    } finally {
      saving.value = false
    }
  }

  function reset() {
    settings.value = null
    options.value = null
    loading.value = false
    saving.value = false
    error.value = ''
  }

  return { settings, options, loading, saving, error, fetch, update, reset }
})
