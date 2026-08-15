<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import FollowButton from '@/components/profile/FollowButton.vue'
import { conversationsApi } from '@/api/conversations'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'
import { icons } from '@/lib/icons'
import type { FollowRelationship, MessagingState } from '@/types'

/**
 * The two things you can do about another person: follow them, and write to
 * them.
 *
 * ## "Xabar" never checks first
 *
 * It posts straight to `/conversations/direct`, which is idempotent. There is
 * deliberately no "does a conversation already exist" lookup here — the
 * uniqueness guarantee is a database index, not a round trip, and a client-side
 * check would only add a window in which two taps could disagree. Pressing the
 * button twice, from two tabs, or after already sharing four activities all
 * open the same conversation.
 *
 * `sending` guards the double-tap for the user's sake — two navigations in
 * flight is a bad experience — not for correctness. Correctness is the server's.
 */
const props = defineProps<{
  userId: number
  relationship: FollowRelationship
  /** Absent on an anonymous view; the button simply is not rendered then. */
  messaging?: MessagingState | null
}>()

const emit = defineEmits<{ 'update:relationship': [value: FollowRelationship] }>()

const router = useRouter()
const toast = useToast()
const sending = ref(false)

async function message() {
  if (sending.value) return

  // A refusal we already know about is answered here rather than by a round
  // trip that will fail — the reason came with the profile for exactly this.
  if (props.messaging && !props.messaging.can_message) {
    if (props.messaging.reason) toast.error(props.messaging.reason)

    return
  }

  sending.value = true

  try {
    const { data } = await conversationsApi.openWith(props.userId)

    await router.push({ name: 'chat-detail', params: { conversationId: data.data.id } })
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center gap-2">
    <FollowButton
      :user-id="userId"
      :relationship="relationship"
      @update:relationship="emit('update:relationship', $event)"
    />

    <button
      v-if="messaging"
      type="button"
      class="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-sm font-medium border border-border bg-surface text-ink-secondary transition-colors hover:border-primary-300 hover:text-primary-700 disabled:opacity-50 disabled:hover:border-border disabled:hover:text-ink-secondary"
      :disabled="sending || !messaging.can_message"
      :title="messaging.can_message ? undefined : (messaging.reason ?? undefined)"
      :aria-busy="sending"
      @click="message"
    >
      <span
        v-if="sending"
        class="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
      />
      <FontAwesomeIcon v-else :icon="icons.chat" class="text-[0.7rem]" />
      Xabar
    </button>
  </div>
</template>
