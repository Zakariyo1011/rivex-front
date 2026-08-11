<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/composables/useApiError'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const phone = ref('+998')
const password = ref('')
const passwordConfirmation = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.register({
      name: name.value,
      phone: phone.value.replace(/\s+/g, ''),
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    })
    router.push({ name: 'verify-phone' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <h2 class="text-2xl font-bold text-ink mb-1">Ro'yxatdan o'tish</h2>
    <p class="text-ink-muted mb-6">Hisobingizni yarating</p>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <AppInput v-model="name" label="Ism" placeholder="Azizbek Abdullayev" autocomplete="name" />
      <AppInput v-model="phone" label="Telefon raqam" placeholder="+998 90 123 45 67" autocomplete="tel" />
      <AppInput v-model="password" label="Parol" type="password" autocomplete="new-password" />
      <AppInput
        v-model="passwordConfirmation"
        label="Parolni tasdiqlang"
        type="password"
        autocomplete="new-password"
      />

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <AppButton type="submit" :loading="loading">Ro'yxatdan o'tish</AppButton>
    </form>

    <p class="text-center text-sm text-ink-muted mt-6">
      Hisobingiz bormi?
      <RouterLink :to="{ name: 'login' }" class="text-primary-600 font-medium">Kirish</RouterLink>
    </p>
  </AuthLayout>
</template>
