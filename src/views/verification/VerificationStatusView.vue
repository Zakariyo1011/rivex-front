<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import VerificationStep from '@/components/verification/VerificationStep.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { useVerificationStore } from '@/stores/verification'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { KycStatus } from '@/types'
import { formatDate } from '@/lib/datetime'

const router = useRouter()
const verification = useVerificationStore()
const auth = useAuthStore()

const hasError = ref(false)

/**
 * One screen, five outcomes. Keeping them in a single map rather than five
 * components makes it obvious that every KYC state has a defined presentation
 * — including the ones that are easy to forget, like needs_review.
 */
const presentation: Record<
  KycStatus,
  { icon: typeof icons.pending; tone: string; title: string; body: string }
> = {
  not_verified: {
    icon: icons.identity,
    tone: 'bg-primary-50 text-primary-600',
    title: 'Tasdiqlash boshlanmagan',
    body: "Pullik faoliyatlar uchun shaxsingizni tasdiqlashingiz kerak.",
  },
  pending: {
    icon: icons.pending,
    tone: 'bg-warning-bg text-warning',
    title: "Ko'rib chiqilmoqda",
    body: "Hujjatlaringiz qabul qilindi. Tekshiruv odatda bir necha soat ichida yakunlanadi — natija haqida xabar beramiz.",
  },
  needs_review: {
    icon: icons.pending,
    tone: 'bg-warning-bg text-warning',
    title: "Qo'shimcha tekshiruv",
    body: "Hujjatlaringiz qo'lda tekshirilmoqda. Sizdan boshqa hech narsa talab qilinmaydi.",
  },
  verified: {
    icon: icons.verified,
    tone: 'bg-success-bg text-success',
    title: 'Shaxsingiz tasdiqlandi',
    body: "Endi pullik faoliyatlar yaratishingiz, ularga qo'shilishingiz va pul yechishingiz mumkin.",
  },
  rejected: {
    icon: icons.warning,
    tone: 'bg-danger-bg text-danger',
    title: 'Tasdiqlanmadi',
    body: "Hujjatlaringiz qabul qilinmadi. Quyidagi sababni ko'rib chiqing va qaytadan urinib ko'ring.",
  },
}

const current = computed(() => presentation[verification.status as KycStatus] ?? presentation.not_verified)

async function load() {
  hasError.value = false
  try {
    await verification.fetch()
    // Status may have moved since login (an admin approved it), so keep the
    // user object — which the verification gates read — in step.
    await auth.fetchMe().catch(() => undefined)
  } catch {
    hasError.value = true
  }
}

onMounted(load)
</script>

<template>
  <VerificationStep
    :icon="current.icon"
    :title="current.title"
    :show-back="false"
  >
    <div v-if="verification.loading && !verification.verification" class="space-y-3">
      <Skeleton variant="block" height="6rem" class="rounded-2xl" />
      <Skeleton variant="block" height="3rem" class="rounded-xl" />
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <template v-else>
      <div class="card p-5 text-center mb-6">
        <span
          class="w-14 h-14 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3"
          :class="current.tone"
        >
          <FontAwesomeIcon :icon="current.icon" />
        </span>
        <p class="text-[15px] text-ink-secondary leading-relaxed">{{ current.body }}</p>

        <p
          v-if="verification.status === 'rejected' && verification.verification?.rejection_reason"
          class="mt-4 rounded-xl bg-danger-bg text-danger text-sm px-4 py-3 text-left"
        >
          {{ verification.verification.rejection_reason }}
        </p>

        <p v-if="verification.verification?.submitted_at" class="text-xs text-ink-faint mt-4">
          Yuborilgan: {{ formatDate(verification.verification.submitted_at) }}
        </p>
      </div>

      <AppButton v-if="verification.isVerified" @click="router.push({ name: 'home' })">
        Bosh sahifaga
      </AppButton>

      <template v-else-if="verification.status === 'rejected'">
        <AppButton
          v-if="verification.canSubmit"
          @click="verification.clearFiles(); router.push({ name: 'verification-document' })"
        >
          Qaytadan urinish
        </AppButton>
        <p v-else class="text-sm text-ink-muted text-center">
          Urinishlar soni tugadi. Qo'llab-quvvatlash xizmatiga murojaat qiling.
        </p>
      </template>

      <template v-else-if="verification.isAwaitingReview">
        <AppButton variant="outline" :loading="verification.loading" @click="load">
          Holatni yangilash
        </AppButton>
        <button
          type="button"
          class="w-full text-center text-sm text-ink-faint mt-4"
          @click="router.push({ name: 'home' })"
        >
          Bosh sahifaga qaytish
        </button>
      </template>

      <AppButton v-else @click="router.push({ name: 'verification-intro' })">Tasdiqlashni boshlash</AppButton>
    </template>
  </VerificationStep>
</template>
