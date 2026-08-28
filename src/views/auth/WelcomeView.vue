<script setup lang="ts">
import AuthLayout from '@/layouts/AuthLayout.vue'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.vue'
import { icons } from '@/lib/icons'

/**
 * The first screen, and now the only one before Google.
 *
 * There is no longer a register/login fork: with Google as the sole method,
 * "Ro'yxatdan o'tish" and "Kirish" were two buttons that did exactly the same
 * thing, and asking a new user to choose between them was a decision with no
 * consequence. One button; the backend decides whether it is a sign-up.
 */
</script>

<template>
  <AuthLayout>
    <div class="md:hidden text-center mb-10">
      <div
        class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl text-primary-600 mx-auto mb-4"
      >
        <FontAwesomeIcon :icon="icons.brand" />
      </div>
      <h1 class="text-2xl font-bold text-ink">Rivex</h1>
      <p class="text-ink-muted mt-1">Har qanday faoliyat uchun sherik toping.</p>

      <ul class="mt-6 space-y-2.5 text-left inline-block">
        <li
          v-for="feature in ['Tasdiqlangan foydalanuvchilar', 'Xavfsiz va ishonchli', 'Haqiqiy aloqalar']"
          :key="feature"
          class="flex items-center gap-2.5 text-sm text-ink-secondary"
        >
          <span
            class="w-5 h-5 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px]"
          >
            <FontAwesomeIcon :icon="icons.check" />
          </span>
          {{ feature }}
        </li>
      </ul>
    </div>

    <div class="hidden md:block mb-8">
      <h2 class="text-2xl font-bold text-ink">Xush kelibsiz!</h2>
      <p class="text-ink-muted mt-1">Davom etish uchun Google hisobingiz bilan kiring.</p>
    </div>

    <GoogleSignInButton />

    <p class="text-center text-xs text-ink-faint mt-6 leading-relaxed">
      Davom etish orqali siz Rivex shartlariga rozilik bildirasiz.<br />
      Telefon raqamingizni keyinroq profilingizdan qo'shasiz.
    </p>
  </AuthLayout>
</template>
