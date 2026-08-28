<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import VerificationStep from '@/components/verification/VerificationStep.vue'
import ImagePicker from '@/components/verification/ImagePicker.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useVerificationStore } from '@/stores/verification'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

const router = useRouter()
const verification = useVerificationStore()

const error = ref('')

const rules = [
  'Yuzingiz to\'liq ko\'rinsin',
  'Ko\'zoynak, niqob yoki bosh kiyimsiz',
  "Yorug' joyda, fon sokin bo'lsin",
  'Hujjatdagi rasmga o\'xshash bo\'lsin',
]

const canSubmit = computed(() => !!verification.selfieFile && verification.documentsComplete)

onMounted(() => {
  // Deep-linked here without every required page (e.g. after a reload, which
  // clears the in-memory files on purpose) — send them back to finish. An ID
  // card needs two pages, so "has a document" is not the same question as
  // "has enough of one".
  if (!verification.documentsComplete) {
    router.replace({ name: 'verification-document' })
  }
})

async function onSubmit() {
  if (!canSubmit.value) return
  error.value = ''

  try {
    await verification.submit()
    router.push({ name: 'verification-status' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  }
}
</script>

<template>
  <VerificationStep
    :icon="icons.camera"
    title="Selfi oling"
    description="Hujjatdagi shaxs siz ekanligingizni tasdiqlash uchun yuzingiz rasmi kerak."
    :step="2"
    @back="router.push({ name: 'verification-document' })"
  >
    <ul class="grid grid-cols-2 gap-2.5 mb-6">
      <li
        v-for="rule in rules"
        :key="rule"
        class="rounded-xl bg-surface border border-border px-3 py-2.5 flex items-start gap-2 text-xs text-ink-muted"
      >
        <FontAwesomeIcon :icon="icons.check" class="text-success mt-0.5 shrink-0" />
        <span>{{ rule }}</span>
      </li>
    </ul>

    <ImagePicker
      v-model="verification.selfieFile"
      label="Selfi"
      hint="Old kamera bilan oling · eng ko'pi 8 MB"
      capture="user"
      class="mb-6"
    />

    <div v-if="verification.submitting" class="mb-4">
      <div class="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          class="h-full bg-primary-600 transition-all duration-200"
          :style="{ width: `${verification.uploadProgress}%` }"
        />
      </div>
      <p class="text-xs text-ink-faint text-center mt-2">Yuklanmoqda… {{ verification.uploadProgress }}%</p>
    </div>

    <p v-if="error" class="text-sm text-danger text-center mb-4">{{ error }}</p>

    <AppButton :disabled="!canSubmit" :loading="verification.submitting" @click="onSubmit">
      Tekshiruvga yuborish
    </AppButton>

    <p class="text-xs text-ink-faint text-center mt-4 leading-relaxed">
      <FontAwesomeIcon :icon="icons.lock" class="mr-1" />
      Rasmlaringiz yopiq xotirada saqlanadi va faqat tekshiruv uchun ishlatiladi.
    </p>
  </VerificationStep>
</template>
