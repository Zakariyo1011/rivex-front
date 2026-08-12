<script setup lang="ts">
import { ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import Avatar from '@/components/ui/Avatar.vue'
import RatingInput from '@/components/ui/RatingInput.vue'
import { activitiesApi } from '@/api/activities'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import type { User } from '@/types'

/**
 * Leave a review for one person on a completed activity.
 *
 * Who may be reviewed is decided by the server (`my_reviewable_users` on the
 * activity detail), so this component never reasons about eligibility — it
 * renders the people it was handed and reports what happened.
 */
const props = defineProps<{
  activityId: number
  reviewee: User
}>()

const emit = defineEmits<{ close: []; submitted: [revieweeId: number] }>()

const toast = useToast()

const rating = ref(0)
const comment = ref('')
const submitting = ref(false)
const error = ref('')

async function submit() {
  if (!rating.value) {
    error.value = 'Bahoni tanlang.'
    return
  }

  error.value = ''
  submitting.value = true

  try {
    await activitiesApi.review(props.activityId, {
      reviewee_id: props.reviewee.id,
      rating: rating.value,
      comment: comment.value.trim() || undefined,
    })

    toast.success('Bahoyingiz uchun rahmat.')
    emit('submitted', props.reviewee.id)
  } catch (e) {
    // Duplicate or out-of-window submissions surface the server's own wording
    // rather than a guess made here.
    error.value = extractErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal title="Baho berish" @close="emit('close')">
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <Avatar :src="reviewee.profile?.avatar_url" :name="reviewee.name" />
        <div class="min-w-0">
          <p class="font-semibold text-ink">{{ reviewee.name }}</p>
          <p class="text-sm text-ink-muted">Uchrashuv qanday o'tdi?</p>
        </div>
      </div>

      <RatingInput v-model="rating" :disabled="submitting" />

      <AppTextarea
        v-model="comment"
        label="Izoh (ixtiyoriy)"
        placeholder="Boshqalarga foydali bo'ladigan qisqa izoh qoldiring"
        :rows="3"
      />

      <p class="text-xs text-ink-faint">
        Bahoyingiz ochiq profilda ko'rinadi va ishonch balliga ta'sir qiladi.
      </p>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <div class="flex gap-2">
        <AppButton variant="ghost" class="flex-1" :disabled="submitting" @click="emit('close')">
          Keyinroq
        </AppButton>
        <AppButton class="flex-1" :loading="submitting" :disabled="!rating" @click="submit">
          Yuborish
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>
