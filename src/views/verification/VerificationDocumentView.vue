<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import VerificationStep from '@/components/verification/VerificationStep.vue'
import ImagePicker from '@/components/verification/ImagePicker.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useVerificationStore } from '@/stores/verification'
import { icons } from '@/lib/icons'
import type { KycDocType } from '@/types'

const router = useRouter()
const verification = useVerificationStore()

const docTypes: { value: KycDocType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'id_card', label: 'ID karta' },
]

const tips = [
  'Hujjatning barcha burchaklari kadrga sig\'sin',
  "Yorug'lik yetarli bo'lsin, soya tushmasin",
  'Matn aniq o\'qilsin, xira bo\'lmasin',
]

const canContinue = computed(() => !!verification.documentFile)
</script>

<template>
  <VerificationStep
    :icon="icons.identity"
    title="Hujjatingizni yuklang"
    description="Passport yoki ID kartangizning ma'lumotlar sahifasini suratga oling."
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
          class="h-12 rounded-xl border text-[15px] font-medium transition"
          :class="
            verification.docType === type.value
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-border bg-surface text-ink-muted hover:border-primary-200'
          "
          @click="verification.docType = type.value"
        >
          {{ type.label }}
        </button>
      </div>
    </div>

    <ImagePicker
      v-model="verification.documentFile"
      label="Hujjat rasmi"
      hint="JPG, PNG yoki HEIC · eng ko'pi 8 MB"
      capture="environment"
      class="mb-5"
    />

    <ul class="space-y-2 mb-8">
      <li v-for="tip in tips" :key="tip" class="flex items-start gap-2.5 text-sm text-ink-muted">
        <FontAwesomeIcon :icon="icons.check" class="text-success mt-1 shrink-0 text-xs" />
        <span>{{ tip }}</span>
      </li>
    </ul>

    <AppButton :disabled="!canContinue" @click="router.push({ name: 'verification-selfie' })">
      Davom etish
    </AppButton>
  </VerificationStep>
</template>
