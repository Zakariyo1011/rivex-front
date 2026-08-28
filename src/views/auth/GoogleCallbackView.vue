<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore, GOOGLE_FLOW_KEY } from '@/stores/admin'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

/**
 * Where Google sends the browser back to.
 *
 * This screen exists to do one thing and get out of the way: hand `code` and
 * `state` to the backend, take the token it returns, and route onward. It
 * renders a spinner rather than a message, because on the happy path it is on
 * screen for a few hundred milliseconds and anything else would flash.
 *
 * The failure path is the one worth designing: a cancelled consent screen, an
 * expired code and a stale state all land here, and each needs to say what
 * happened and offer the way back — not a blank page.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const adminStore = useAdminStore()

const error = ref('')

onMounted(async () => {
  const code = route.query.code as string | undefined
  const state = route.query.state as string | undefined
  const googleError = route.query.error as string | undefined

  if (googleError) {
    // Clear the marker too: a cancelled admin sign-in must not leave the next
    // consumer sign-in trying to redeem at the admin endpoint.
    sessionStorage.removeItem(GOOGLE_FLOW_KEY)
    error.value = 'Google orqali kirish bekor qilindi.'

    return
  }

  /**
   * Which sign-in this is completing.
   *
   * Both the consumer and the admin flow come back here, so only ONE
   * Authorised redirect URI has to be registered in Google Cloud Console —
   * adding a second is a step that is easy to get subtly wrong and produces a
   * `redirect_uri_mismatch` nobody can debug from the error alone.
   *
   * The marker is set by whichever store began the flow, and it decides only
   * which BACKEND endpoint the code is redeemed at. It is not a security
   * boundary: the two flows mint states into separate server-side namespaces,
   * so an admin state is not redeemable at the consumer callback or the other
   * way round, whatever this browser claims.
   */
  const isAdminFlow = sessionStorage.getItem(GOOGLE_FLOW_KEY) === 'admin'

  if (isAdminFlow) {
    try {
      await adminStore.completeGoogleSignIn({ code, state })
      await router.replace({ name: 'admin-dashboard' })
    } catch (e) {
      error.value = extractErrorMessage(e)
    }

    return
  }

  try {
    const result = await auth.completeGoogleSignIn({ code, state })

    if (!result) {
      error.value = "Kirishni yakunlab bo'lmadi. Qaytadan urinib ko'ring."

      return
    }

    // Onboarding decides where a brand-new account lands (region, then handle);
    // the router guard owns that decision, so this just goes home and lets the
    // guard redirect. One place knows the onboarding order.
    await auth.fetchMe()
    await router.replace({ name: 'home' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  }
})
</script>

<template>
  <AuthLayout :show-brand-panel="false">
    <div v-if="!error" class="text-center py-10" data-testid="google-callback-pending">
      <FontAwesomeIcon :icon="icons.spinner" class="animate-spin text-3xl text-primary-600" />
      <p class="text-ink-muted mt-4">Kirilmoqda…</p>
    </div>

    <div v-else class="text-center py-6" data-testid="google-callback-error">
      <div
        class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center text-2xl mx-auto mb-4"
      >
        <FontAwesomeIcon :icon="icons.error" />
      </div>
      <h2 class="text-lg font-bold text-ink">Kirib bo'lmadi</h2>
      <p class="text-sm text-ink-muted mt-2 mb-6">{{ error }}</p>

      <AppButton @click="router.replace({ name: 'welcome' })">Qaytadan urinish</AppButton>
    </div>
  </AuthLayout>
</template>
