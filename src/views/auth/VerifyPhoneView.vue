<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/composables/useApiError'

const router = useRouter()
const auth = useAuthStore()

const digits = ref<string[]>(['', '', '', '', '', ''])
const inputs = ref<HTMLInputElement[]>([])
const loading = ref(false)
const error = ref('')
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function startCooldown(seconds = 45) {
  cooldown.value = seconds
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

onMounted(() => startCooldown())
onUnmounted(() => clearInterval(timer))

function onDigitInput(index: number, event: Event) {
  const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(-1)
  digits.value[index] = value
  if (value && index < 5) inputs.value[index + 1]?.focus()
  if (digits.value.every((d) => d)) onSubmit()
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    inputs.value[index - 1]?.focus()
  }
}

async function onSubmit() {
  const code = digits.value.join('')
  if (code.length !== 6) return
  error.value = ''
  loading.value = true
  try {
    await auth.verifyPhone(code)
    router.push({ name: 'home' })
  } catch (e) {
    error.value = extractErrorMessage(e)
    digits.value = ['', '', '', '', '', '']
    inputs.value[0]?.focus()
  } finally {
    loading.value = false
  }
}

async function onResend() {
  if (cooldown.value > 0) return
  error.value = ''
  try {
    await auth.resendOtp()
    startCooldown()
  } catch (e) {
    error.value = extractErrorMessage(e)
  }
}
</script>

<template>
  <AuthLayout :show-brand-panel="false">
    <div class="text-center mb-8">
      <div class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl mx-auto mb-4">
        📱
      </div>
      <h2 class="text-2xl font-bold text-gray-900">Telefon tasdiqlash</h2>
      <p class="text-gray-500 mt-1">
        {{ auth.pendingPhone ?? auth.user?.phone }} raqamiga yuborilgan kodni kiriting
      </p>
    </div>

    <div class="flex justify-center gap-2.5 mb-6">
      <input
        v-for="(digit, index) in digits"
        :key="index"
        :ref="(el) => { if (el) inputs[index] = el as HTMLInputElement }"
        :value="digit"
        type="text"
        inputmode="numeric"
        maxlength="1"
        class="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-semibold rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
        @input="onDigitInput(index, $event)"
        @keydown="onKeydown(index, $event)"
      />
    </div>

    <p v-if="error" class="text-sm text-red-500 text-center mb-4">{{ error }}</p>

    <AppButton :loading="loading" @click="onSubmit">Tasdiqlash</AppButton>

    <p class="text-center text-sm text-gray-500 mt-6">
      <button
        type="button"
        class="text-primary-600 font-medium disabled:text-gray-400"
        :disabled="cooldown > 0"
        @click="onResend"
      >
        {{ cooldown > 0 ? `Kodni qayta yuborish (${cooldown}s)` : 'Kodni qayta yuborish' }}
      </button>
    </p>
  </AuthLayout>
</template>
