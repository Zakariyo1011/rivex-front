<script setup lang="ts">
import { computed, ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const toast = useToast()

/**
 * Two steps on purpose: the code goes to the NEW number, so completing the flow
 * proves the user actually holds it. A hijacked session cannot move an account
 * onto an attacker's phone without receiving that SMS.
 */
const step = ref<'phone' | 'code'>('phone')
const phone = ref('+998')
const code = ref('')
const busy = ref(false)
const error = ref('')

const phoneValid = computed(() => /^\+998\d{9}$/.test(phone.value.replace(/\s+/g, '')))
const codeValid = computed(() => /^\d{6}$/.test(code.value))

async function requestCode() {
  if (!phoneValid.value) return
  error.value = ''
  busy.value = true

  try {
    await authApi.requestPhoneChange(phone.value.replace(/\s+/g, ''))
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
    const { data } = await authApi.confirmPhoneChange({
      phone: phone.value.replace(/\s+/g, ''),
      code: code.value,
    })

    // The stored user still carries the old number until we refetch.
    await auth.fetchMe().catch(() => undefined)
    toast.success(data.message)
    emit('close')
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal title="Telefon raqamni o'zgartirish" @close="emit('close')">
    <template v-if="step === 'phone'">
      <p class="text-sm text-ink-muted mb-4">
        Yangi raqamga tasdiqlash kodi yuboriladi. Joriy raqam:
        <span class="text-ink font-medium">{{ auth.user?.phone }}</span>
      </p>

      <AppInput v-model="phone" label="Yangi telefon raqam" placeholder="+998 90 123 45 67" autocomplete="tel" />

      <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

      <AppButton class="mt-4" :disabled="!phoneValid" :loading="busy" @click="requestCode">
        Kod yuborish
      </AppButton>
    </template>

    <template v-else>
      <p class="text-sm text-ink-muted mb-4">
        <span class="text-ink font-medium">{{ phone }}</span> raqamiga yuborilgan 6 xonali kodni kiriting.
      </p>

      <AppInput v-model="code" label="Tasdiqlash kodi" placeholder="123456" />

      <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

      <AppButton class="mt-4" :disabled="!codeValid" :loading="busy" @click="confirm">
        Tasdiqlash
      </AppButton>

      <button
        type="button"
        class="w-full text-center text-sm text-ink-faint mt-3"
        @click="((step = 'phone'), (code = ''), (error = ''))"
      >
        Raqamni o'zgartirish
      </button>
    </template>
  </AppModal>
</template>
