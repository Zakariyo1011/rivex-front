<script setup lang="ts">
import AuthLayout from '@/layouts/AuthLayout.vue'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.vue'

/**
 * Kept as a route because links, bookmarks and the 401 interceptor all point
 * here — but there is no form on it any more. Phone + password sign-in was
 * removed; the only credential Rivex accepts is a Google identity it has
 * verified for itself.
 */
</script>

<template>
  <AuthLayout>
    <h2 class="text-2xl font-bold text-ink mb-1">Kirish</h2>
    <p class="text-ink-muted mb-6">Google hisobingiz bilan davom eting</p>

    <GoogleSignInButton label="Google orqali kirish" />

    <p class="text-center text-xs text-ink-faint mt-6 leading-relaxed">
      Hisobingiz bo'lmasa, Google orqali kirganingizda avtomatik yaratiladi.
    </p>
  </AuthLayout>
</template>
