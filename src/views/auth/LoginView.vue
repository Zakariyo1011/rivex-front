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

const phone = ref('+998')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login({ phone: phone.value.replace(/\s+/g, ''), password: password.value })
    router.push({ name: 'home' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <h2 class="text-2xl font-bold text-gray-900 mb-1">Kirish</h2>
    <p class="text-gray-500 mb-6">Hisobingizga qaytganingizdan xursandmiz</p>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <AppInput v-model="phone" label="Telefon raqam" placeholder="+998 90 123 45 67" autocomplete="tel" />
      <AppInput v-model="password" label="Parol" type="password" autocomplete="current-password" />

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <AppButton type="submit" :loading="loading">Kirish</AppButton>
    </form>

    <p class="text-center text-sm text-gray-500 mt-6">
      Hisobingiz yo'qmi?
      <RouterLink :to="{ name: 'register' }" class="text-primary-600 font-medium">Ro'yxatdan o'tish</RouterLink>
    </p>
  </AuthLayout>
</template>
