<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { profileApi } from '@/api/profile'
import { useAuthStore } from '@/stores/auth'
import { useUsernameCheck } from '@/composables/useUsernameCheck'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const suggestions = ref<string[]>([])
const saving = ref(false)
const error = ref('')

/**
 * The shape rule and the debounced check now live in `useUsernameCheck`,
 * shared with the profile editor. They were duplicated here first; keeping two
 * copies of a mirror of a server rule is how a screen ends up accepting a
 * handle the API refuses.
 *
 * No `current` is passed: this screen exists precisely because there is no
 * handle yet.
 */
const { normalised, status, reason, reject } = useUsernameCheck(username)

const canSubmit = computed(() => status.value === 'available' && !saving.value)

watch(normalised, () => {
  error.value = ''
})

async function submit() {
  if (!canSubmit.value) return

  saving.value = true
  error.value = ''

  try {
    await profileApi.updateUsername(normalised.value)
    await auth.fetchMe()
    // Interests are optional, but this is the one moment the user is
    // already in a setup frame of mind. The screen itself offers a skip.
    router.push({ name: 'onboarding-interests' })
  } catch (e) {
    error.value = extractErrorMessage(e)
    // The server is the authority, so a rejection here overrides whatever the
    // advisory check said a moment ago.
    reject(error.value)
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
