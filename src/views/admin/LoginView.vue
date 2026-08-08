<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useAdminStore } from '@/stores/admin'
import { extractErrorMessage } from '@/composables/useApiError'

const router = useRouter()
const admin = useAdminStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

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
  <div class="min-h-screen bg-surface-muted flex items-center justify-center px-6">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2 mb-8 justify-center">
        <div class="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white text-lg">🤝</div>
        <div>
          <p class="font-bold text-ink leading-tight">Rivex</p>
          <p class="text-xs text-ink-faint leading-tight">Admin panel</p>
        </div>
      </div>

      <div class="card p-6">
        <h1 class="text-lg font-bold text-ink mb-1">Admin kirish</h1>
        <p class="text-sm text-ink-muted mb-6">Boshqaruv paneliga kirish uchun tizimga kiring</p>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <AppInput v-model="email" label="Email" type="email" placeholder="admin@rivex.local" autocomplete="username" />
          <AppInput v-model="password" label="Parol" type="password" autocomplete="current-password" />

          <p v-if="error" class="text-sm text-danger">{{ error }}</p>

          <AppButton type="submit" :loading="loading">Kirish</AppButton>
        </form>
      </div>
    </div>
  </div>
</template>
