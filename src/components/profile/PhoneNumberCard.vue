<script setup lang="ts">
import { computed, ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

/**
 * The phone number on a profile: one row, four states, one flow to change it.
 *
 * Google authenticates; the number is contact and trust information added
 * afterwards. It is still what unlocks creating and joining activities, so the
 * row says so when it is missing — a gate the user only meets at the moment
 * they are refused is a gate they experience as a bug.
 *
 * The two-step flow is unchanged from when this was a credential, and for the
 * same reason: the code goes to the NEW number, so completing it proves the
 * person holds that number. A hijacked session alone cannot move an account
 * onto somebody else's phone.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const auth = useAuthStore()
const toast = useToast()

const open = ref(false)
const step = ref<'phone' | 'code'>('phone')
const phone = ref('+998')
const code = ref('')
const busy = ref(false)
const error = ref('')

const state = computed(() => auth.phone)
const status = computed(() => state.value?.status ?? 'not_added')

/** Pre-spaced by the server, so no numbering plan is encoded in the client. */
const displayNumber = computed(
  () => state.value?.formatted ?? state.value?.phone ?? null,
)

const pendingNumber = computed(
  () => state.value?.pending_formatted ?? state.value?.pending_phone ?? null,
)

const badge = computed(() => {
  switch (status.value) {
    case 'verified':
      return { label: 'Tasdiqlangan', class: 'bg-success-bg text-success', icon: icons.verified }
    case 'pending':
      return { label: 'Tasdiqlanmoqda', class: 'bg-warning-bg text-warning', icon: icons.pending }
    case 'unverified':
      return { label: 'Tasdiqlanmagan', class: 'bg-surface-muted text-ink-muted', icon: icons.warning }
    default:
      return { label: "Qo'shilmagan", class: 'bg-surface-muted text-ink-muted', icon: icons.phone }
  }
})

const actionLabel = computed(() =>
  status.value === 'not_added' ? "Raqam qo'shish" : "Raqamni o'zgartirish",
)

// Advisory only — the server normalises and validates for real. This exists so
// the button is not enabled for something obviously incomplete.
const phoneValid = computed(() => /^\+?\d[\d\s]{7,17}$/.test(phone.value.trim()))
const codeValid = computed(() => /^\d{6}$/.test(code.value))

function start() {
  error.value = ''
  code.value = ''
  phone.value = state.value?.phone ?? '+998'

  // A change already in flight resumes at the code step rather than making the
  // user retype a number they have already been sent a code for.
  step.value = status.value === 'pending' ? 'code' : 'phone'
  open.value = true
}

async function requestCode() {
  if (!phoneValid.value) return

  error.value = ''
  busy.value = true

  try {
    await auth.requestPhoneVerification(phone.value)
    step.value = 'code'
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function confirm() {
  if (!codeValid.value) return

  error.value = ''
  busy.value = true

  try {
    const result = await auth.confirmPhoneVerification(code.value)
    toast.success(result.message)
    open.value = false
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function resend() {
  error.value = ''
  busy.value = true

  try {
    const result = await auth.resendPhoneCode()
    toast.success(result.message)
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function cancelPending() {
  busy.value = true

  try {
    await auth.cancelPhoneVerification()
    step.value = 'phone'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 text-left"
      :class="compact ? 'px-4 py-3.5 hover:bg-surface-muted transition' : ''"
      data-testid="phone-row"
      @click="start"
    >
      <span class="flex items-center gap-3 min-w-0">
        <FontAwesomeIcon :icon="icons.phone" class="text-ink-faint w-4 shrink-0" />
        <span class="min-w-0">
          <span class="block text-sm font-medium text-ink">Telefon raqami</span>
          <span class="block text-sm text-ink-muted truncate">
            {{ displayNumber ?? (pendingNumber ? `${pendingNumber} — kod kutilmoqda` : "Kiritilmagan") }}
          </span>
        </span>
      </span>

      <span class="flex items-center gap-2 shrink-0">
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
          :class="badge.class"
        >
          <FontAwesomeIcon :icon="badge.icon" class="text-[0.6rem]" />
          {{ badge.label }}
        </span>
        <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
      </span>
    </button>

    <!-- Why the number matters, said before it is needed rather than at the
         moment the user is turned away from creating an activity. -->
    <p
      v-if="!compact && status !== 'verified'"
      class="text-xs text-ink-faint mt-2 leading-relaxed"
    >
      Faoliyat yaratish va faoliyatga qo'shilish uchun tasdiqlangan telefon raqami kerak.
    </p>

    <AppModal
      v-if="open"
      :title="step === 'phone' ? actionLabel : 'Raqamni tasdiqlash'"
      @close="open = false"
    >
      <template v-if="step === 'phone'">
        <p class="text-sm text-ink-muted mb-4">
          Raqamingizga 6 xonali tasdiqlash kodi yuboriladi.
          <span v-if="displayNumber" class="block mt-1">
            Joriy raqam: <span class="text-ink font-medium">{{ displayNumber }}</span>
          </span>
        </p>

        <AppInput
          v-model="phone"
          label="Telefon raqami"
          placeholder="+998 90 123 45 67"
          autocomplete="tel"
          inputmode="tel"
          data-testid="phone-input"
        />

        <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

        <AppButton class="mt-4" :disabled="!phoneValid" :loading="busy" @click="requestCode">
          Kod yuborish
        </AppButton>

        <AppButton
          v-if="status === 'verified' || status === 'unverified'"
          class="mt-2"
          variant="ghost"
          :loading="busy"
          @click="auth.removePhone().then(() => (open = false))"
        >
          Raqamni o'chirish
        </AppButton>
      </template>

      <template v-else>
        <p class="text-sm text-ink-muted mb-4">
          <span class="text-ink font-medium">{{ pendingNumber ?? phone }}</span>
          raqamiga yuborilgan kodni kiriting.
        </p>

        <AppInput
          v-model="code"
          label="Tasdiqlash kodi"
          placeholder="123456"
          inputmode="numeric"
          maxlength="6"
          data-testid="phone-code-input"
        />

        <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

        <AppButton class="mt-4" :disabled="!codeValid" :loading="busy" @click="confirm">
          Tasdiqlash
        </AppButton>

        <div class="flex items-center justify-between mt-3 text-sm">
          <button type="button" class="text-primary-600 font-medium" :disabled="busy" @click="resend">
            Kodni qayta yuborish
          </button>
          <button type="button" class="text-ink-faint" :disabled="busy" @click="cancelPending">
            Raqamni o'zgartirish
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>
