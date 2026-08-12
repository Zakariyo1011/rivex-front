<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'

/**
 * A nudge, not a wall.
 *
 * Verification is only *required* for paid activities and payouts, so this
 * banner explains what is still locked rather than blocking the page. It hides
 * itself entirely once the user is verified, and stays quiet while a review is
 * in flight — nagging someone who has already done their part is just noise.
 */
const router = useRouter()
const auth = useAuthStore()

interface BannerState {
  tone: Tone
  icon: (typeof icons)['identity']
  title: string
  body: string
  action: string
  to: { name: string }
}

const state = computed<BannerState | null>(() => {
  const user = auth.user
  if (!user) return null

  if (!user.phone_verified) {
    return {
      tone: 'warning',
      icon: icons.phone,
      title: 'Telefon raqamingizni tasdiqlang',
      body: "Faoliyat yaratish va ariza yuborish uchun kerak.",
      action: 'Tasdiqlash',
      to: { name: 'verify-phone' },
    }
  }

  switch (user.verification_status) {
    case 'verified':
      return null
    case 'pending':
    case 'needs_review':
      return {
        tone: 'info',
        icon: icons.pending,
        title: "Hujjatlaringiz ko'rib chiqilmoqda",
        body: 'Tasdiqlangach pullik faoliyatlar ochiladi.',
        action: 'Holat',
        to: { name: 'verification-status' },
      }
    case 'rejected':
      return {
        tone: 'danger',
        icon: icons.warning,
        title: 'Tasdiqlash rad etildi',
        body: 'Sababni ko\'rib chiqing va qaytadan urinib ko\'ring.',
        action: 'Ko\'rish',
        to: { name: 'verification-status' },
      }
    default:
      return {
        tone: 'primary',
        icon: icons.identity,
        title: 'Shaxsingizni tasdiqlang',
        body: "Pullik faoliyatlar va pul yechish uchun kerak.",
        action: 'Boshlash',
        to: { name: 'verification-intro' },
      }
  }
})

type Tone = 'primary' | 'info' | 'warning' | 'danger'

const toneClasses: Record<Tone, { wrap: string; icon: string; action: string }> = {
  primary: {
    wrap: 'bg-primary-50 border-primary-200',
    icon: 'bg-primary-100 text-primary-700',
    action: 'bg-primary-600 text-white hover:bg-primary-700',
  },
  info: {
    wrap: 'bg-surface border-border',
    icon: 'bg-surface-muted text-ink-muted',
    action: 'bg-surface-muted text-ink-secondary hover:bg-border',
  },
  warning: {
    wrap: 'bg-warning-bg border-warning/25',
    icon: 'bg-warning/15 text-warning',
    action: 'bg-warning text-white hover:opacity-90',
  },
  danger: {
    wrap: 'bg-danger-bg border-danger/25',
    icon: 'bg-danger/15 text-danger',
    action: 'bg-danger text-white hover:opacity-90',
  },
}
</script>

<template>
  <div
    v-if="state"
    class="rounded-2xl border px-4 py-3.5 flex items-center gap-3.5"
    :class="toneClasses[state.tone].wrap"
  >
    <span
      class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
      :class="toneClasses[state.tone].icon"
    >
      <FontAwesomeIcon :icon="state.icon" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="font-semibold text-ink text-sm">{{ state.title }}</p>
      <p class="text-xs text-ink-muted mt-0.5">{{ state.body }}</p>
    </div>

    <button
      type="button"
      class="shrink-0 h-9 px-4 rounded-xl text-sm font-semibold transition"
      :class="toneClasses[state.tone].action"
      @click="router.push(state.to)"
    >
      {{ state.action }}
    </button>
  </div>
</template>
