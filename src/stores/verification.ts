import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { verificationApi, type SubmitVerificationPayload } from '@/api/verification'
import { useAuthStore } from '@/stores/auth'
import type { IdentityVerification, KycDocType } from '@/types'

/**
 * Holds the KYC wizard's in-progress state across its screens.
 *
 * The picked files live in memory only: a passport scan must not end up in
 * localStorage, so a page reload deliberately restarts the wizard.
 */
export const useVerificationStore = defineStore('verification', () => {
  const verification = ref<IdentityVerification | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const uploadProgress = ref(0)

  const docType = ref<KycDocType>('passport')
  const documentFile = ref<File | null>(null)
  const selfieFile = ref<File | null>(null)

  const status = computed(() => verification.value?.status ?? 'not_verified')
  const isVerified = computed(() => status.value === 'verified')
  const isAwaitingReview = computed(() => status.value === 'pending' || status.value === 'needs_review')
  const canSubmit = computed(() => verification.value?.can_submit ?? true)
  const attemptsLeft = computed(() =>
    verification.value ? Math.max(0, verification.value.max_attempts - verification.value.attempts) : null,
  )

  async function fetch() {
    loading.value = true
    try {
      const { data } = await verificationApi.show()
      verification.value = data.data
      return data.data
    } finally {
      loading.value = false
    }
  }

  async function submit() {
    if (!documentFile.value || !selfieFile.value) {
      throw new Error('Hujjat va selfi rasmlari tanlanmagan.')
    }

    submitting.value = true
    uploadProgress.value = 0

    try {
      const payload: SubmitVerificationPayload = {
        doc_type: docType.value,
        document_image: documentFile.value,
        selfie_image: selfieFile.value,
      }

      const { data } = await verificationApi.submit(payload, (percent) => {
        uploadProgress.value = percent
      })

      verification.value = data.data
      clearFiles()

      // The gate reads verification status off the user, so refresh it —
      // otherwise the UI would still think paid actions are locked.
      await useAuthStore().fetchMe().catch(() => undefined)

      return data.data
    } finally {
      submitting.value = false
    }
  }

  function clearFiles() {
    documentFile.value = null
    selfieFile.value = null
    uploadProgress.value = 0
  }

  function reset() {
    verification.value = null
    docType.value = 'passport'
    clearFiles()
  }

  return {
    verification,
    loading,
    submitting,
    uploadProgress,
    docType,
    documentFile,
    selfieFile,
    status,
    isVerified,
    isAwaitingReview,
    canSubmit,
    attemptsLeft,
    fetch,
    submit,
    clearFiles,
    reset,
  }
})
