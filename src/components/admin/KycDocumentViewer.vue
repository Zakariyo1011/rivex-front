<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import adminClient from '@/api/adminClient'
import { icons } from '@/lib/icons'
import type { VerificationDocument } from '@/types'

/**
 * Renders KYC document thumbnails for a reviewing admin.
 *
 * The files are only served by an authenticated, audit-logged admin endpoint,
 * so a plain `<img src>` would not work — the bearer token has to be sent.
 * Each document is fetched as a blob and shown from an object URL, which also
 * means nothing is ever written to a cache or a shareable link.
 */
const props = defineProps<{ documents: VerificationDocument[] }>()

const objectUrls = ref<Record<number, string>>({})
const loading = ref(false)
const failed = ref(false)

function release() {
  Object.values(objectUrls.value).forEach((url) => URL.revokeObjectURL(url))
  objectUrls.value = {}
}

async function load() {
  release()
  if (props.documents.length === 0) return

  loading.value = true
  failed.value = false

  try {
    const loaded = await Promise.all(
      props.documents.map(async (document) => {
        const { data } = await adminClient.get<Blob>(document.path, { responseType: 'blob' })
        return [document.id, URL.createObjectURL(data)] as const
      }),
    )

    objectUrls.value = Object.fromEntries(loaded)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.documents, load, { immediate: true })
onBeforeUnmount(release)

/**
 * Fallback page names, for a row stored before the server sent a label.
 *
 * The server resolves `document.label` from App\Kyc\KycDocumentType, which is
 * the authority — a reviewer about to open a stranger's identity document must
 * be told which side they are looking at, and inferring it from row order was
 * how an ID card's back could be mistaken for its front.
 */
const labels: Record<string, string> = {
  passport: "Passport ma'lumotlar sahifasi",
  id_card_front: 'ID karta — old tomoni',
  id_card_back: 'ID karta — orqa tomoni',
  selfie: 'Selfi',
}

const captionFor = (document: VerificationDocument) =>
  document.label || labels[document.doc_type] || document.doc_type
</script>

<template>
  <div>
    <p class="text-xs font-medium text-ink-muted mb-2 flex items-center gap-1.5">
      <FontAwesomeIcon :icon="icons.lock" />
      Hujjatlar — faqat tekshiruv uchun, har bir ochilish audit logga yoziladi
    </p>

    <p v-if="loading" class="text-sm text-ink-faint">Yuklanmoqda…</p>

    <p v-else-if="failed" class="text-sm text-danger">Hujjatlarni yuklab bo'lmadi.</p>

    <!-- One tile per page. An ID card contributes two, a passport one, and the
         selfie is always present — so the grid is sized for three and wraps. -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
      <figure
        v-for="document in documents"
        :key="document.id"
        class="rounded-xl border border-border overflow-hidden bg-surface-muted"
        :data-testid="`kyc-doc-${document.doc_type}`"
      >
        <img
          v-if="objectUrls[document.id]"
          :src="objectUrls[document.id]"
          :alt="captionFor(document)"
          class="w-full aspect-[4/3] object-contain bg-black/5"
        />
        <figcaption class="px-3 py-2 text-xs text-ink-muted border-t border-border">
          {{ captionFor(document) }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>
