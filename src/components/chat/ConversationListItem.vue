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

/**
 * The green dot.
 *
 * Server-resolved, not a presence channel: a row per conversation would mean a
 * presence subscription per conversation. `is_online` already carries the
 * `show_online_status` gate and the block check — see UserPresenceService — so
 * this renders what it is given and decides nothing.
 */
const isOnline = computed(() => isDirect.value && props.conversation.counterpart?.is_online === true)

/**
 * The handle, for the rows where it disambiguates.
 *
 * Only shown when it is not already the title. A display name is what people
 * recognise; the handle earns its place next to it when two contacts share a
 * first name, and is noise when the name is unique — so it renders small,
 * beside the name, and is the first thing dropped when the row is narrow.
 */
const handle = computed(() => {
  if (!isDirect.value) return null

  const username = person.value?.username
  if (!username) return null

  // Compared in its rendered form. An account with no display name is titled
  // by its handle, and `jasur !== '@jasur'` would then be true — showing the
  // handle twice on exactly the rows it was meant to be redundant on.
  const formatted = `@${username}`

  return formatted === title.value ? null : formatted
})

/**
 * Up to three faces for a group row, and how many people are really in it.
 *
 * `participants_count` is the server's count of the whole room rather than
 * `faces.length`, so "+4" stays right however many the payload happened to
 * carry.
 */
const faces = computed(() => (props.conversation.participants ?? []).slice(0, 3))

const overflow = computed(() =>
  Math.max(0, (props.conversation.participants_count ?? 0) - faces.value.length),
)

const memberCount = computed(() => props.conversation.participants_count ?? 0)
</script>

<template>
  <RouterLink
    :to="{ name: 'chat-detail', params: { conversationId: conversation.id } }"
    class="card card-hover p-3.5 flex items-center gap-3"
  >
    <div class="relative shrink-0">
      <template v-if="isDirect">
        <Avatar :src="person?.profile?.avatar_url" :name="person?.name ?? ''" size="lg" />

        <!-- Ringed in the row's own background so the dot reads as a badge on
             the avatar rather than a speck floating over it. -->
        <span
          v-if="isOnline"
          class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success ring-2 ring-surface"
          aria-label="Onlayn"
          data-testid="online-dot"
        />
      </template>

      <!-- A group is its people, so the row shows them. The generic people
           icon that stood here said only "this is a group", which the activity
           title already said. -->
      <!-- Sized by its contents, not boxed to `w-12`. Three 32px avatars
           overlapping by 12px are 72px wide, so a fixed 48px box let the last
           face render on top of the conversation title. -->
      <div v-else-if="faces.length" class="flex items-center h-12 shrink-0">
        <span
          v-for="(member, index) in faces"
          :key="member.id"
          class="rounded-full ring-2 ring-surface"
          :class="index > 0 ? '-ml-3' : ''"
          :style="{ zIndex: String(faces.length - index) }"
        >
          <Avatar :src="member.profile?.avatar_url" :name="member.name ?? ''" size="sm" />
        </span>

        <span
          v-if="overflow > 0"
          class="-ml-3 w-8 h-8 rounded-full ring-2 ring-surface bg-surface-muted text-ink-muted text-[10px] font-semibold flex items-center justify-center"
        >
          +{{ overflow }}
        </span>
      </div>

      <span
        v-else
        class="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center"
      >
        <FontAwesomeIcon :icon="icons.people" />
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <p class="font-semibold text-ink truncate">{{ title }}</p>

        <span v-if="handle" class="text-xs text-ink-faint truncate hidden sm:inline">
          {{ handle }}
        </span>

        <span v-if="!isDirect && memberCount > 0" class="text-xs text-ink-faint shrink-0">
          · {{ memberCount }}
        </span>

        <span class="text-[11px] text-ink-faint shrink-0 ml-auto">{{ stamp }}</span>
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
