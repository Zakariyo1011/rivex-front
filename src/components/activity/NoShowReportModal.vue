<script setup lang="ts">
import { ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import { noShowApi } from '@/api/noshow'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'
import { icons } from '@/lib/icons'
import type { User } from '@/types'

const props = defineProps<{ activityId: number; person: User }>()
const emit = defineEmits<{ close: []; reported: [] }>()

const toast = useToast()
const note = ref('')
const submitting = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  submitting.value = true

  try {
    await noShowApi.report(props.activityId, props.person.id, note.value || undefined)
    toast.success('Shikoyat yuborildi')
    emit('reported')
    emit('close')
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal title="Kelmadi deb belgilash" @close="emit('close')">
    <!-- Setting expectations up front: this is not a punish button. -->
    <div class="rounded-xl bg-surface-muted px-4 py-3 mb-4 flex gap-2.5 text-sm text-ink-secondary">
      <FontAwesomeIcon :icon="icons.info" class="mt-0.5 shrink-0 text-ink-faint" />
      <span>
        {{ person.name }} bu haqda xabar oladi va 48 soat ichida javob berishi mumkin. Faqat
        tasdiqlangan holat ishonch balliga ta'sir qiladi.
      </span>
    </div>

    <AppTextarea
      v-model="note"
      label="Nima bo'ldi? (ixtiyoriy)"
      :rows="3"
      placeholder="Qisqacha tushuntiring"
    />

    <p v-if="error" class="text-sm text-danger mt-3">{{ error }}</p>

    <AppButton class="mt-4" variant="danger" :loading="submitting" @click="submit">
      Yuborish
    </AppButton>
  </AppModal>
</template>
