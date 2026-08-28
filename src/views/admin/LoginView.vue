<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.vue'
import { useAdminStore } from '@/stores/admin'
import { adminAuthApi } from '@/api/admin'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

/**
 * The way into the admin panel.
 *
 * ---------------------------------------------------------------------------
 * GOOGLE FIRST, PASSWORD SECOND
 * ---------------------------------------------------------------------------
 *
 * Rivex users authenticate with Google and hold no password at all. The panel
 * keeping its own email-and-password login meant the product had two
 * authentication systems, and the weaker one guarded the screens that read
 * strangers' passports and move money — a password that exists only for
 * administrators is a password nobody rotates.
 *
 * So Google is the primary path and is presented as such. The password form is
 * kept, below a divider, for a deliberate reason rather than nostalgia: an
 * identity-provider outage must not lock every administrator out of the panel
 * that would be used to diagnose it. Accounts created without a password
 * simply cannot use it, and are told so rather than left guessing.
 */
const router = useRouter()
const admin = useAdminStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const googleConfigured = ref<boolean | null>(null)
const googleIsFake = ref(false)
const showPasswordForm = ref(false)

onMounted(async () => {
  try {
    const { data } = await adminAuthApi.googleStatus()
    googleConfigured.value = data.data.configured
    googleIsFake.value = data.data.fake
  } catch {
    // A failed status check must not hide the button: the sign-in attempt
    // itself produces a clearer message than a blank panel would.
    googleConfigured.value = true
  }

  // With Google unavailable the password form is the only way in, so it is
  // opened rather than hidden behind a link to nowhere.
  if (googleConfigured.value === false) showPasswordForm.value = true
})

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    await admin.login({ email: email.value, password: password.value })
    router.push({ name: 'admin-dashboard' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-muted flex items-center justify-center px-4 sm:px-6 py-10">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2 mb-8 justify-center">
        <div
          class="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white text-lg"
        >
          <FontAwesomeIcon :icon="icons.brand" />
        </div>
        <div>
          <p class="font-bold text-ink leading-tight">Rivex</p>
          <p class="text-xs text-ink-faint leading-tight">Admin panel</p>
        </div>
      </div>

      <div class="card p-6">
        <h1 class="text-lg font-bold text-ink mb-1">Admin kirish</h1>
        <p class="text-sm text-ink-muted mb-6">
          Boshqaruv paneliga faqat ruxsat berilgan hisoblar kira oladi.
        </p>

        <!-- The primary path, and the same component the consumer sign-in
             screen uses. `flow="admin"` selects the backend that admits only
             named admin accounts; everything visual is shared so the two
             buttons cannot drift apart. -->
        <GoogleSignInButton flow="admin" label="Google orqali davom etish" />

        <p
          v-if="googleIsFake"
          class="mt-2 text-xs text-warning flex items-center gap-1.5 justify-center"
        >
          <FontAwesomeIcon :icon="icons.testMode" />
          Test rejimi — haqiqiy Google hisobi ishlatilmaydi
        </p>

        <p v-if="error" class="mt-3 text-sm text-danger" data-testid="admin-login-error">
          {{ error }}
        </p>

        <!-- The fallback, folded away. Present so a Google outage cannot lock
             every administrator out, not because it is an equal option. -->
        <div v-if="googleConfigured !== false" class="mt-6 flex items-center gap-3">
          <span class="h-px flex-1 bg-border" />
          <button
            type="button"
            class="text-xs font-medium text-ink-faint hover:text-ink-muted transition"
            @click="showPasswordForm = !showPasswordForm"
          >
            {{ showPasswordForm ? 'Yashirish' : 'Parol bilan kirish' }}
          </button>
          <span class="h-px flex-1 bg-border" />
        </div>

        <form v-if="showPasswordForm" class="space-y-4 mt-5" @submit.prevent="onSubmit">
          <AppInput
            v-model="email"
            label="Email"
            type="email"
            placeholder="admin@rivex.local"
            autocomplete="username"
          />
          <AppInput
            v-model="password"
            label="Parol"
            type="password"
            autocomplete="current-password"
          />

          <AppButton type="submit" :loading="loading">Kirish</AppButton>

          <p class="text-xs text-ink-faint text-center">
            Google orqali yaratilgan hisoblarda parol bo'lmaydi.
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
