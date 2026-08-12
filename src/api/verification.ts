import client from './client'
import type { IdentityVerification, KycDocType } from '@/types'

export interface SubmitVerificationPayload {
  doc_type: KycDocType
  document_image: File
  selfie_image: File
}

export const verificationApi = {
  /** The caller's own verification record. Never anyone else's. */
  show() {
    return client.get<{ data: IdentityVerification }>('/me/verification')
  },

  /**
   * Uploads the ID scan and selfie. Multipart because both are files; the
   * backend stores them on a private disk and they are never readable back
   * through the API — there is deliberately no "fetch my document" endpoint.
   */
  submit(payload: SubmitVerificationPayload, onProgress?: (percent: number) => void) {
    const formData = new FormData()
    formData.append('doc_type', payload.doc_type)
    formData.append('document_image', payload.document_image)
    formData.append('selfie_image', payload.selfie_image)

    return client.post<{ data: IdentityVerification }>('/me/verification/documents', formData, {
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return
        onProgress(Math.round((event.loaded * 100) / event.total))
      },
    })
  },
}
