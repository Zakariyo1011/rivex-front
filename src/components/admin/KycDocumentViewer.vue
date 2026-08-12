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

const labels: Record<string, string> = {
  passport: 'Passport',
  id_card: 'ID karta',
  selfie: 'Selfi',
}
</script>

<template>
  <div>
    <p class="text-xs font-medium text-ink-muted mb-2 flex items-center gap-1.5">
      <FontAwesomeIcon :icon="icons.lock" />
      Hujjatlar — faqat tekshiruv uchun, har bir ochilish audit logga yoziladi
    </p>

    <p v-if="loading" class="text-sm text-ink-faint">Yuklanmoqda…</p>

    <p v-else-if="failed" class="text-sm text-danger">Hujjatlarni yuklab bo'lmadi.</p>

    <div v-else class="grid grid-cols-2 gap-3 max-w-md">
      <figure v-for="document in documents" :key="document.id" class="rounded-xl border border-border overflow-hidden bg-surface-muted">
        <img
          v-if="objectUrls[document.id]"
          :src="objectUrls[document.id]"
          :alt="labels[document.doc_type] ?? document.doc_type"
          class="w-full aspect-[4/3] object-contain bg-black/5"
        />
        <figcaption class="px-3 py-2 text-xs text-ink-muted border-t border-border">
          {{ labels[document.doc_type] ?? document.doc_type }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>
