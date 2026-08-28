import client from './client'
import type { IdentityVerification, KycDocType } from '@/types'

/**
 * The pages each document type requires, mirrored from App\Kyc\KycDocumentType.
 *
 * A passport's data page is self-contained; an ID card keeps the photograph and
 * name on the front and the address, issuing authority and machine-readable
 * zone on the back, so half an ID card is not an ID card.
 *
 * This copy is a COURTESY, not a control. The server validates the same rule
 * and refuses an incomplete submission with a 422 naming the missing page —
 * see SubmitVerificationRequest. What this buys is that the wizard can ask for
 * the right number of photographs instead of discovering the requirement after
 * an upload.
 */
export const REQUIRED_PAGES: Record<KycDocType, DocumentPage[]> = {
  passport: ['document_image'],
  id_card: ['document_front_image', 'document_back_image'],
}

export type DocumentPage =
  | 'document_image'
  | 'document_front_image'
  | 'document_back_image'

/** What to call each page on screen. */
export const PAGE_LABELS: Record<DocumentPage, { label: string; hint: string }> = {
  document_image: {
    label: "Passport ma'lumotlar sahifasi",
    hint: 'Rasmingiz va ismingiz bor sahifa',
  },
  document_front_image: {
    label: 'ID karta — old tomoni',
    hint: 'Rasmingiz va ismingiz bor tomoni',
  },
  document_back_image: {
    label: 'ID karta — orqa tomoni',
    hint: 'Manzil va shtrix-kod bor tomoni',
  },
}

export interface SubmitVerificationPayload {
  doc_type: KycDocType
  /** Keyed by request field name; which keys are needed comes from REQUIRED_PAGES. */
  pages: Partial<Record<DocumentPage, File>>
  selfie_image: File
}

export const verificationApi = {
  /** The caller's own verification record. Never anyone else's. */
  show() {
    return client.get<{ data: IdentityVerification }>('/me/verification')
  },

  /**
   * Uploads the document pages and the selfie.
   *
   * Multipart because these are files; the backend stores them on a private
   * disk and they are never readable back through the API — there is
   * deliberately no "fetch my document" endpoint, only an audit-logged admin
   * streaming route.
   */
  submit(payload: SubmitVerificationPayload, onProgress?: (percent: number) => void) {
    const formData = new FormData()
    formData.append('doc_type', payload.doc_type)

    for (const [field, file] of Object.entries(payload.pages)) {
      if (file) formData.append(field, file)
    }

    formData.append('selfie_image', payload.selfie_image)

    return client.post<{ data: IdentityVerification }>('/me/verification/documents', formData, {
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return
        onProgress(Math.round((event.loaded * 100) / event.total))
      },
    })
  },
}
