<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import { icons } from '@/lib/icons'
import { formatTime, formatDate } from '@/lib/datetime'
import { useAuthStore } from '@/stores/auth'
import type { Conversation } from '@/types'
import { userDisplayName } from '@/lib/userLink'

/**
 * One row of the chat list.
 *
 * The row this replaces showed a person's name with the *activity title*
 * underneath, which read as a list of activities rather than of conversations —
 * and made four activities with one person look like four different chats. A
 * conversation row shows who and what was last said.
 */
const props = defineProps<{ conversation: Conversation }>()

const auth = useAuthStore()

const isDirect = computed(() => props.conversation.type === 'direct')
const person = computed(() => props.conversation.counterpart)

const title = computed(() =>
  isDirect.value
    ? userDisplayName(person.value)
    : (props.conversation.activity?.title ?? 'Guruh suhbati'),
)

/**
 * The last thing said, prefixed with "Siz:" when it was us.
 *
 * Without the prefix a list of one's own messages reads as if the other person
 * said them.
 */
const preview = computed(() => {
  const message = props.conversation.last_message

  if (!message) return isDirect.value ? 'Suhbatni boshlang' : 'Hali xabar yo‘q'

  const mine = message.sender?.id === auth.user?.id
  const who = mine ? 'Siz: ' : !isDirect.value ? `${message.sender?.name ?? ''}: ` : ''

  return `${who}${message.body}`
})

/** Time today, date before that — the convention every messenger uses. */
const stamp = computed(() => {
  const at = props.conversation.last_message_at
  if (!at) return ''

  const date = new Date(at)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  return sameDay ? formatTime(date) : formatDate(date)
})

const unread = computed(() => props.conversation.unread_count ?? 0)
</script>

<template>
  <RouterLink
    :to="{ name: 'chat-detail', params: { conversationId: conversation.id } }"
    class="card card-hover p-3.5 flex items-center gap-3"
  >
    <div class="relative shrink-0">
      <Avatar
        v-if="isDirect"
        :src="person?.profile?.avatar_url"
        :name="person?.name ?? ''"
        size="lg"
      />
      <span
        v-else
        class="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center"
      >
        <FontAwesomeIcon :icon="icons.people" />
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <p class="font-semibold text-ink truncate flex-1">{{ title }}</p>
        <span class="text-[11px] text-ink-faint shrink-0">{{ stamp }}</span>
      </div>

      <div class="flex items-center gap-2 mt-0.5">
        <p
          class="text-sm truncate flex-1"
          :class="unread > 0 ? 'text-ink font-medium' : 'text-ink-muted'"
        >
          {{ preview }}
        </p>

        <span
          v-if="unread > 0"
          class="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-semibold flex items-center justify-center"
          :aria-label="`${unread} o‘qilmagan xabar`"
        >
          {{ unread > 99 ? '99+' : unread }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
