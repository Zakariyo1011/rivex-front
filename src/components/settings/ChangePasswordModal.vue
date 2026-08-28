<script setup lang="ts">
import { computed, ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { authApi } from '@/api/auth'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'

/**
 * A password is optional now.
 *
 * Google is the credential the account rests on; this is a second way in that
 * a user may choose to add. So the form has two shapes: setting the FIRST
 * password asks for nothing to re-prove — there is nothing to prove and the
 * session is the authorisation — while changing an existing one still demands
 * the current one, so a hijacked session cannot lock the owner out.
 */
const props = withDefaults(defineProps<{ hasPassword?: boolean }>(), { hasPassword: true })

const emit = defineEmits<{ close: [] }>()

/** Kept out of the template so the apostrophes do not fight the attribute quoting. */
const modalTitles = {
  change: "Parolni o'zgartirish",
  add: "Parol qo'shish",
}

const toast = useToast()

const current = ref('')
const next = ref('')
const confirm = ref('')
const saving = ref(false)
const error = ref('')

// Mirrors the server rule (Password::min(8)) so the user hears about it before
// a round trip; the server stays the authority.
const canSubmit = computed(
  () =>
    (!props.hasPassword || current.value.length > 0) &&
    next.value.length >= 8 &&
    next.value === confirm.value,
)

const mismatch = computed(() => confirm.value.length > 0 && next.value !== confirm.value)

async function submit() {
  if (!canSubmit.value) return
  error.value = ''
  saving.value = true

  try {
    const { data } = await authApi.changePassword({
      ...(props.hasPassword ? { current_password: current.value } : {}),
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
  <AppModal
    :title="props.hasPassword ? modalTitles.change : modalTitles.add"
    @close="emit('close')"
  >
    <p class="text-sm text-ink-muted mb-4">
      {{
        props.hasPassword
          ? "Parol o'zgargach boshqa qurilmalardagi seanslar yakunlanadi."
          : "Google orqali kirish asosiy usul bo'lib qoladi. Parol — qo'shimcha imkoniyat."
      }}
    </p>

    <div class="space-y-3">
      <AppInput
        v-if="props.hasPassword"
        v-model="current"
        label="Joriy parol"
        type="password"
        autocomplete="current-password"
      />
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
