<script setup lang="ts">
import { computed, ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import { activitiesApi } from '@/api/activities'
import { cancellationReasons } from '@/lib/statusLabels'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { Activity } from '@/types'

const props = defineProps<{ activity: Activity }>()
const emit = defineEmits<{ close: []; cancelled: [activity: Activity] }>()

const reason = ref<string | null>(null)
const note = ref('')
const submitting = ref(false)
const error = ref('')

/** Matches the backend's LATE_CANCELLATION_HOURS so the warning is honest. */
const LATE_WINDOW_HOURS = 6

const isLate = computed(() => {
  const hoursUntilStart = (new Date(props.activity.start_at).getTime() - Date.now()) / 3_600_000

  return hoursUntilStart > 0 && hoursUntilStart <= LATE_WINDOW_HOURS
})

const hasPaidCommission = computed(() => props.activity.payment_type !== 'free')

async function submit() {
  if (!reason.value) return
  error.value = ''
  submitting.value = true

  try {
    const { data } = await activitiesApi.cancel(
      props.activity.id,
      reason.value,
      note.value || undefined,
    )
    emit('cancelled', data.data)
    emit('close')
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal title="Faoliyatni bekor qilish" @close="emit('close')">
    <!-- Said plainly and before the fact: a late cancellation is recorded and
         it affects the organiser's trust score. -->
    <div
      v-if="isLate"
      class="rounded-xl bg-warning-bg text-warning px-4 py-3 mb-4 flex gap-2.5 text-sm"
    >
      <FontAwesomeIcon :icon="icons.warning" class="mt-0.5 shrink-0" />
      <span>
        Faoliyat boshlanishiga {{ LATE_WINDOW_HOURS }} soatdan kam qoldi. Bu kech bekor qilish
        hisoblanadi va ishonch ballingizga ta'sir qiladi.
      </span>
    </div>

    <p v-if="hasPaidCommission" class="text-sm text-ink-muted mb-4">
      To'langan komissiya hamyoningizga qaytariladi.
    </p>

    <p class="text-sm font-medium text-ink-secondary mb-2">Sababi</p>
    <div class="space-y-2 mb-4">
      <button
        v-for="option in cancellationReasons"
        :key="option.value"
        type="button"
        class="w-full text-left px-4 py-3 rounded-xl border text-sm transition"
        :class="
          reason === option.value
            ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
            : 'border-border bg-surface text-ink-secondary hover:border-primary-200'
        "
        @click="reason = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <AppTextarea
      v-model="note"
      label="Izoh (ixtiyoriy)"
      :rows="2"
      placeholder="Qisqacha tushuntirish"
    />

    <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

    <AppButton
      class="mt-4"
      variant="danger"
      :disabled="!reason"
      :loading="submitting"
      @click="submit"
    >
      Bekor qilish
    </AppButton>
  </AppModal>
</template>
