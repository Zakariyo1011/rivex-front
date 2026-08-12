<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VerificationStep from '@/components/verification/VerificationStep.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useVerificationStore } from '@/stores/verification'
import { icons } from '@/lib/icons'

const router = useRouter()
const verification = useVerificationStore()

const points = [
  {
    icon: icons.trust,
    title: 'Ishonchli hamjamiyat',
    body: "Tasdiqlangan foydalanuvchilar bilan uchrashish ancha xavfsiz — shuning uchun pullik faoliyatlarda bu talab qilinadi.",
  },
  {
    icon: icons.lock,
    title: 'Hujjatlaringiz maxfiy',
    body: "Passport rasmi va selfi shifrlangan yopiq xotirada saqlanadi. Ular boshqa foydalanuvchilarga hech qachon ko'rsatilmaydi.",
  },
  {
    icon: icons.verified,
    title: 'Profilingizda faqat belgi',
    body: "Boshqalar faqat \"Tasdiqlangan\" belgisini ko'radi — passport raqami yoki hujjat rasmi emas.",
  },
]

onMounted(async () => {
  const record = await verification.fetch().catch(() => null)

  // Already submitted or already done — skip straight to the status screen.
  if (record && record.status !== 'not_verified' && record.status !== 'rejected') {
    router.replace({ name: 'verification-status' })
  }
})

function start() {
  router.push({ name: 'verification-document' })
}
</script>

<template>
  <VerificationStep
    :icon="icons.identity"
    title="Shaxsingizni tasdiqlang"
    description="Bu bir necha daqiqa vaqt oladi. Passport yoki ID kartangiz va telefoningiz kamerasi kerak bo'ladi."
    :show-back="true"
    @back="router.back()"
  >
    <div v-if="verification.loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" variant="block" height="5rem" class="rounded-2xl" />
    </div>

    <template v-else>
      <ul class="space-y-3 mb-8">
        <li v-for="point in points" :key="point.title" class="card p-4 flex gap-3.5">
          <span
            class="w-10 h-10 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"
          >
            <FontAwesomeIcon :icon="point.icon" />
          </span>
          <div class="min-w-0">
            <p class="font-semibold text-ink text-[15px]">{{ point.title }}</p>
            <p class="text-sm text-ink-muted mt-0.5 leading-relaxed">{{ point.body }}</p>
          </div>
        </li>
      </ul>

      <p
        v-if="verification.verification?.status === 'rejected' && verification.verification.rejection_reason"
        class="rounded-xl bg-danger-bg text-danger text-sm px-4 py-3 mb-4"
      >
        Oldingi urinish rad etilgan: {{ verification.verification.rejection_reason }}
      </p>

      <AppButton :disabled="!verification.canSubmit" @click="start">Boshlash</AppButton>

      <p v-if="!verification.canSubmit" class="text-sm text-ink-muted text-center mt-3">
        Urinishlar soni tugadi. Qo'llab-quvvatlash xizmatiga murojaat qiling.
      </p>
      <p v-else-if="verification.attemptsLeft !== null" class="text-xs text-ink-faint text-center mt-3">
        Qolgan urinishlar: {{ verification.attemptsLeft }}
      </p>

      <button type="button" class="w-full text-center text-sm text-ink-faint mt-4" @click="router.push({ name: 'home' })">
        Keyinroq
      </button>
    </template>
  </VerificationStep>
</template>
