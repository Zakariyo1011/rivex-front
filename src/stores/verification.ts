import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  REQUIRED_PAGES,
  verificationApi,
  type DocumentPage,
  type SubmitVerificationPayload,
} from '@/api/verification'
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

  /**
   * The picked pages, keyed by request field.
   *
   * A map rather than one `documentFile` ref because how many pages exist is a
   * property of the document type, not of the wizard — an ID card has two and a
   * passport has one, and a single ref could only ever hold the first.
   */
  const pages = ref<Partial<Record<DocumentPage, File>>>({})
  const selfieFile = ref<File | null>(null)

  /** The pages this document type needs, in the order they are asked for. */
  const requiredPages = computed<DocumentPage[]>(() => REQUIRED_PAGES[docType.value] ?? [])

  /** Which required pages are still missing — drives the wizard's next step. */
  const missingPages = computed(() => requiredPages.value.filter((page) => !pages.value[page]))

  const documentsComplete = computed(() => missingPages.value.length === 0)

  function setPage(page: DocumentPage, file: File | null) {
    if (file) pages.value = { ...pages.value, [page]: file }
    else {
      const next = { ...pages.value }
      delete next[page]
      pages.value = next
    }
  }

  /**
   * Switching document type discards pages that belonged to the other one.
   *
   * Keeping them would mean an ID-card front lingering after somebody switched
   * to passport, and being submitted as a passport data page.
   */
  function setDocType(value: KycDocType) {
    if (value === docType.value) return

    docType.value = value
    pages.value = {}
  }

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
    if (!documentsComplete.value || !selfieFile.value) {
      throw new Error('Hujjat va selfi rasmlari tanlanmagan.')
    }

    submitting.value = true
    uploadProgress.value = 0

    try {
      const payload: SubmitVerificationPayload = {
        doc_type: docType.value,
        pages: pages.value,
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
    pages.value = {}
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
    setDocType,
    pages,
    setPage,
    requiredPages,
    missingPages,
    documentsComplete,
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
