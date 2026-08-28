<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import VerificationStep from '@/components/verification/VerificationStep.vue'
import ImagePicker from '@/components/verification/ImagePicker.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useVerificationStore } from '@/stores/verification'
import { PAGE_LABELS, type DocumentPage } from '@/api/verification'
import { icons } from '@/lib/icons'
import type { KycDocType } from '@/types'

/**
 * Step one of KYC: photograph the document.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCREEN ASKS FOR A DIFFERENT NUMBER OF PHOTOS
 * ---------------------------------------------------------------------------
 *
 * It used to ask for exactly one image whatever the document was. That is right
 * for a passport, whose data page carries the photograph, the name, the number
 * and the machine-readable zone together — and wrong for an Uzbek ID card,
 * where the front has the photograph and the name and the BACK has the address,
 * the issuing authority and the MRZ. Every ID-card submission was therefore
 * reaching a reviewer with half the evidence, and nothing in the flow said so.
 *
 * How many pages are needed is a property of the document type, so it is read
 * from `REQUIRED_PAGES` rather than hardcoded here — and the server enforces
 * the same rule, so this screen is a courtesy that saves a round trip, never
 * the control. See App\Kyc\KycDocumentType.
 */
const router = useRouter()
const verification = useVerificationStore()

const docTypes: { value: KycDocType; label: string; hint: string }[] = [
  { value: 'passport', label: 'Passport', hint: "1 ta rasm" },
  { value: 'id_card', label: 'ID karta', hint: '2 ta rasm' },
]

const tips = [
  "Hujjatning barcha burchaklari kadrga sig'sin",
  "Yorug'lik yetarli bo'lsin, soya tushmasin",
  "Matn aniq o'qilsin, xira bo'lmasin",
]

/** The pages to ask for, with their copy, in the order they are collected. */
const pageFields = computed(() =>
  verification.requiredPages.map((page: DocumentPage) => ({
    key: page,
    ...PAGE_LABELS[page],
  })),
)

const canContinue = computed(() => verification.documentsComplete)
</script>

<template>
  <VerificationStep
    :icon="icons.identity"
    title="Hujjatingizni yuklang"
    description="Passport yoki ID kartangizni suratga oling."
    :step="1"
    @back="router.push({ name: 'verification-intro' })"
  >
    <div class="mb-6">
      <p class="text-sm font-medium text-ink-secondary mb-2">Hujjat turi</p>
      <div class="grid grid-cols-2 gap-2.5">
        <button
          v-for="type in docTypes"
          :key="type.value"
          type="button"
          class="min-h-[3.5rem] px-3 py-2 rounded-xl border text-[15px] font-medium transition"
          :class="
            verification.docType === type.value
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-border bg-surface text-ink-muted hover:border-primary-200'
          "
          :aria-pressed="verification.docType === type.value"
          :data-testid="`kyc-doc-type-${type.value}`"
          @click="verification.setDocType(type.value)"
        >
          <span class="block">{{ type.label }}</span>
          <!-- How many photographs this choice will ask for, said up front
               rather than discovered one screen later. -->
          <span class="block text-xs font-normal opacity-70 mt-0.5">{{ type.hint }}</span>
        </button>
      </div>
    </div>

    <!-- One picker per required page. Keyed by field name so switching
         document type replaces the pickers rather than reusing them with a
         stale file behind them. -->
    <div class="space-y-5 mb-5">
      <ImagePicker
        v-for="field in pageFields"
        :key="field.key"
        :model-value="verification.pages[field.key] ?? null"
        :label="field.label"
        :hint="`${field.hint} · JPG, PNG yoki HEIC · eng ko'pi 8 MB`"
        capture="environment"
        :data-testid="`kyc-page-${field.key}`"
        @update:model-value="verification.setPage(field.key, $event)"
      />
    </div>

    <ul class="space-y-2 mb-8">
      <li v-for="tip in tips" :key="tip" class="flex items-start gap-2.5 text-sm text-ink-muted">
        <FontAwesomeIcon :icon="icons.check" class="text-success mt-1 shrink-0 text-xs" />
        <span>{{ tip }}</span>
      </li>
    </ul>

    <AppButton
      :disabled="!canContinue"
      data-testid="kyc-document-continue"
      @click="router.push({ name: 'verification-selfie' })"
    >
      Davom etish
    </AppButton>

    <!-- Names what is still missing. A disabled button that will not say why is
         the specific dead end this replaces. -->
    <p v-if="!canContinue" class="mt-2 text-xs text-ink-faint text-center">
      {{ verification.missingPages.length }} ta rasm qoldi
    </p>
  </VerificationStep>
</template>
