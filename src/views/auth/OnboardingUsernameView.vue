<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { profileApi } from '@/api/profile'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const suggestions = ref<string[]>([])
const saving = ref(false)
const error = ref('')

/**
 * Availability state for the handle currently typed.
 *
 * `idle` also covers "too short to bother asking", which is why the check is
 * not simply a boolean: an empty field is not unavailable, it is unanswered.
 */
const status = ref<'idle' | 'checking' | 'available' | 'taken'>('idle')
const reason = ref<string | null>(null)

/** Mirrors the server rule so the obvious mistakes never cost a round trip. */
const FORMAT = /^[a-z0-9](?:[a-z0-9_]{1,28})[a-z0-9]$/

const normalised = computed(() => username.value.trim().toLowerCase())
const canSubmit = computed(() => status.value === 'available' && !saving.value)

let checkToken = 0
let debounce: ReturnType<typeof setTimeout> | undefined

function localComplaint(value: string): string | null {
  if (value.length < 3) return "Kamida 3 ta belgi bo'lishi kerak."
  if (value.length > 30) return '30 ta belgidan oshmasligi kerak.'
  if (!FORMAT.test(value)) return 'Faqat lotin harflari, raqamlar va pastki chiziq.'
  if (value.includes('__')) return "Ketma-ket ikkita pastki chiziq bo'lmasligi kerak."
  if (/^\d+$/.test(value)) return "Faqat raqamlardan iborat bo'la olmaydi."
  return null
}

/**
 * Every keystroke would otherwise be a request, and the endpoint is rate
 * limited precisely because it answers an existence question. The token guards
 * against an earlier, slower response overwriting a later one.
 */
watch(normalised, (value) => {
  clearTimeout(debounce)
  error.value = ''

  if (!value) {
    status.value = 'idle'
    reason.value = null
    return
  }

  const complaint = localComplaint(value)
  if (complaint) {
    status.value = 'taken'
    reason.value = complaint
    return
  }

  status.value = 'checking'
  const token = ++checkToken

  debounce = setTimeout(async () => {
    try {
      const { data } = await profileApi.checkUsername(value)
      if (token !== checkToken) return

      status.value = data.available ? 'available' : 'taken'
      reason.value = data.reason
    } catch {
      if (token !== checkToken) return
      // A failed check is not a taken handle. Let them try to submit; the
      // server decides for real.
      status.value = 'idle'
      reason.value = null
    }
  }, 350)
})

async function submit() {
  if (!canSubmit.value) return

  saving.value = true
  error.value = ''

  try {
    await profileApi.updateUsername(normalised.value)
    await auth.fetchMe()
    router.push({ name: 'home' })
  } catch (e) {
    error.value = extractErrorMessage(e)
    // The server is the authority, so a rejection here overrides whatever the
    // advisory check said a moment ago.
    status.value = 'taken'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const { data } = await profileApi.usernameSuggestions()
    suggestions.value = data.data
  } catch {
    // Suggestions are a convenience; the field works without them.
  }
})
</script>

<template>
  <AuthLayout :show-brand-panel="false">
    <div class="text-center mb-8">
      <div
        class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl text-primary-600 mx-auto mb-4"
      >
        <FontAwesomeIcon :icon="icons.profile" />
      </div>
      <h2 class="text-2xl font-bold text-ink">Foydalanuvchi nomingiz</h2>
      <p class="text-ink-muted mt-1">
        Odamlar sizni shu nom orqali topadi. Keyinchalik o'zgartira olasiz.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <label class="block">
        <span class="block text-sm font-medium text-ink-secondary mb-1.5">Foydalanuvchi nomi</span>
        <div
          class="flex items-center h-12 px-4 rounded-xl border bg-surface transition-colors"
          :class="{
            'border-border': status === 'idle' || status === 'checking',
            'border-success': status === 'available',
            'border-danger': status === 'taken',
          }"
        >
          <span class="text-ink-faint mr-0.5 select-none">@</span>
          <input
            v-model="username"
            type="text"
            inputmode="text"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            maxlength="30"
            placeholder="zakariyo_dev"
            class="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
          />
          <FontAwesomeIcon
            v-if="status === 'available'"
            :icon="icons.check"
            class="text-success text-sm"
          />
          <span
            v-else-if="status === 'checking'"
            class="w-4 h-4 rounded-full border-2 border-border border-t-primary-500 animate-spin"
          />
        </div>

        <p v-if="status === 'taken' && reason" class="mt-1.5 text-sm text-danger">{{ reason }}</p>
        <p v-else-if="status === 'available'" class="mt-1.5 text-sm text-success">
          Bu nom bo'sh.
        </p>
      </label>

      <div v-if="suggestions.length" class="space-y-2">
        <span class="block text-sm font-medium text-ink-secondary">Takliflar</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="px-3 h-9 rounded-full border border-border bg-surface-muted text-sm text-ink-secondary hover:border-primary-300 hover:text-primary-700 transition-colors"
            @click="username = suggestion"
          >
            @{{ suggestion }}
          </button>
        </div>
      </div>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <AppButton type="submit" block :disabled="!canSubmit" :loading="saving">
        Davom etish
      </AppButton>
    </form>
  </AuthLayout>
</template>
