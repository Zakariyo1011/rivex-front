<script setup lang="ts">
import { computed, ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { authApi } from '@/api/auth'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{ close: [] }>()

const toast = useToast()

const current = ref('')
const next = ref('')
const confirm = ref('')
const saving = ref(false)
const error = ref('')

// Mirrors the server rule (Password::min(8)) so the user hears about it before
// a round trip; the server stays the authority.
const canSubmit = computed(
  () => current.value.length > 0 && next.value.length >= 8 && next.value === confirm.value,
)

const mismatch = computed(() => confirm.value.length > 0 && next.value !== confirm.value)

async function submit() {
  if (!canSubmit.value) return
  error.value = ''
  saving.value = true

  try {
    const { data } = await authApi.changePassword({
      current_password: current.value,
      password: next.value,
      password_confirmation: confirm.value,
    })

    toast.success(data.message)
    emit('close')
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal title="Parolni o'zgartirish" @close="emit('close')">
    <p class="text-sm text-ink-muted mb-4">
      Parol o'zgargach boshqa qurilmalardagi seanslar yakunlanadi.
    </p>

    <div class="space-y-3">
      <AppInput v-model="current" label="Joriy parol" type="password" autocomplete="current-password" />
      <AppInput v-model="next" label="Yangi parol" type="password" autocomplete="new-password" />
      <AppInput
        v-model="confirm"
        label="Yangi parolni tasdiqlang"
        type="password"
        autocomplete="new-password"
        :error="mismatch ? 'Parollar mos kelmadi' : undefined"
      />
    </div>

    <p v-if="next.length > 0 && next.length < 8" class="text-xs text-ink-faint mt-2">
      Kamida 8 ta belgi bo'lishi kerak.
    </p>

    <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

    <AppButton class="mt-4" :disabled="!canSubmit" :loading="saving" @click="submit">
      Saqlash
    </AppButton>
  </AppModal>
</template>
