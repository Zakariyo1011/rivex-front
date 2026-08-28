<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'

/**
 * "Google orqali davom etish" — the one way into Rivex.
 *
 * The button asks the backend for a consent URL and then leaves the page. It
 * never touches Google directly and never learns the client secret: the code
 * comes back to /auth/google/callback and the backend redeems it.
 *
 * `configured` is checked first so the screen can be honest. A button that
 * fails when pressed is worse than a button that explains it is not set up
 * yet, and with no credentials in .env that is exactly the state.
 */
const props = withDefaults(defineProps<{ label?: string }>(), {
  label: 'Google orqali davom etish',
})

const auth = useAuthStore()

const loading = ref(false)
const configured = ref<boolean | null>(null)
const error = ref('')

/** Where Google sends the browser back to. Must match the Cloud Console entry. */
const redirectUri = computed(() => `${window.location.origin}/auth/google/callback`)

onMounted(async () => {
  try {
    const { data } = await authApi.googleStatus()
    configured.value = data.data.configured
  } catch {
    // A failed status check must not hide the button — the sign-in attempt
    // itself will produce a clearer message than a blank screen.
    configured.value = true
  }
})

async function signIn() {
  error.value = ''
  loading.value = true

  try {
    const { url } = await auth.beginGoogleSignIn(redirectUri.value)
    window.location.href = url
  } catch (e: unknown) {
    const response = (e as { response?: { data?: { message?: string } } }).response
    error.value = response?.data?.message ?? "Google bilan bog'lanib bo'lmadi. Qaytadan urinib ko'ring."
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <button
      type="button"
      class="w-full h-12 rounded-xl border border-border bg-surface text-ink font-semibold text-[15px] flex items-center justify-center gap-3 transition-all duration-150 hover:border-primary-300 hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      :disabled="loading || configured === false"
      data-testid="google-sign-in"
      @click="signIn"
    >
      <FontAwesomeIcon v-if="loading" :icon="icons.spinner" class="animate-spin text-primary-600" />
      <!-- Google's own mark, inline: the CSP forbids remote assets and a
           coloured G is what makes this button recognisable at a glance. -->
      <svg v-else class="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59A14.46 14.46 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      <span>{{ props.label }}</span>
    </button>

    <p v-if="configured === false" class="text-sm text-ink-muted text-center">
      Google orqali kirish hozircha sozlanmagan. Administratorga murojaat qiling.
    </p>

    <p v-if="error" class="text-sm text-danger text-center">{{ error }}</p>
  </div>
</template>
