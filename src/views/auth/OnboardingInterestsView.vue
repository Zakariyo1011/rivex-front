<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import InterestPicker from '@/components/profile/InterestPicker.vue'
import { interestsApi } from '@/api/interests'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'

/**
 * Optional by design.
 *
 * Interests make matching work, but demanding them before someone has seen the
 * product is a wall rather than an onboarding — the same reasoning that keeps
 * identity verification out of the required chain. The router guard does not
 * enforce this screen; it is offered once and can be skipped, and the profile
 * editor asks again later.
 */
const router = useRouter()

const selected = ref<number[]>([])
const saving = ref(false)
const error = ref('')

async function save() {
  saving.value = true
  error.value = ''
  try {
    await interestsApi.sync(selected.value)
    router.push({ name: 'home' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    saving.value = false
  }
}

function skip() {
  router.push({ name: 'home' })
}
</script>

<template>
  <AuthLayout :show-brand-panel="false">
    <div class="text-center mb-6">
      <div
        class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl text-primary-600 mx-auto mb-4"
      >
        <FontAwesomeIcon :icon="icons.explore" />
      </div>
      <h2 class="text-2xl font-bold text-ink">Nima qiziq?</h2>
      <p class="text-ink-muted mt-1">
        Sizga mos odam va faoliyatlarni topishimiz uchun bir nechtasini tanlang.
      </p>
    </div>

    <div class="max-h-[50vh] overflow-y-auto -mx-1 px-1">
      <InterestPicker :selected="selected" @update:selected="selected = $event" />
    </div>

    <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

    <div class="mt-6 space-y-2">
      <AppButton block :loading="saving" :disabled="selected.length === 0" @click="save">
        Davom etish
      </AppButton>
      <button
        type="button"
        class="w-full h-11 text-sm text-ink-muted hover:text-ink transition-colors"
        @click="skip"
      >
        Keyinroq
      </button>
    </div>
  </AuthLayout>
</template>
