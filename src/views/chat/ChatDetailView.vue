<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ConnectionBanner from '@/components/layout/ConnectionBanner.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageComposer from '@/components/chat/MessageComposer.vue'
import ActivityContext from '@/components/chat/ActivityContext.vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel, type PresenceMember } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { usePresence } from '@/composables/usePresence'
import { useTypingIndicator } from '@/composables/useTypingIndicator'
import { formatDate } from '@/lib/datetime'
import type { Message } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const chat = useChatStore()

const conversationId = computed(() => Number(route.params.conversationId))
const scrollArea = ref<HTMLElement | null>(null)

const presence = usePresence()

const isGroup = computed(() => chat.active?.type === 'activity')

/** Only meaningful for a direct thread — a group has many "others". */
const counterpartOnline = computed(() =>
  chat.active?.type === 'direct' ? presence.isOnline(chat.active.counterpart?.id) : false,
)

/**
 * The newest of my messages the other side has read.
 *
 * One receipt, on the last read message, rather than one per bubble: a column
 * of ticks is noise, and what a person wants to know is "have they got up to
 * here yet".
 */
const lastReadOwnMessageId = computed(() => {
  const mine = chat.messages.filter((m) => m.sender.id === auth.user?.id && m.read_at)

  return mine.at(-1)?.id ?? null
})

/**
 * Messages with the presentation decisions already made.
 *
 * Computed once here rather than asked per bubble: whether to draw a tail and
 * whether to start a new day both depend on the *previous* message, which a
 * bubble cannot see.
 */
interface Row {
  message: Message
  own: boolean
  showTail: boolean
  daySeparator: string | null
}

const rows = computed<Row[]>(() =>
  chat.messages.map((message, index) => {
    const previous = chat.messages[index - 1]
    const own = message.sender.id === auth.user?.id

    const sameSender = previous?.sender.id === message.sender.id
    const closeInTime =
      previous !== undefined &&
      new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 120_000

    const newDay =
      previous === undefined ||
      new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString()

    return {
      message,
      own,
      // A tail marks the *last* bubble of a run, so the run reads as one block
      // pointing at its sender.
      showTail: !sameSender || !closeInTime || newDay,
      daySeparator: newDay ? dayLabel(message.created_at) : null,
    }
  }),
)

function dayLabel(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (date.toDateString() === now.toDateString()) return 'Bugun'
  if (date.toDateString() === yesterday.toDateString()) return 'Kecha'

  return formatDate(date)
}

async function scrollToBottom() {
  await nextTick()
  scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight })
}

/**
 * Load older messages when the reader reaches the top, keeping their place.
 *
 * Prepending content moves everything down by exactly the height that was
 * added, so the scroll position has to be restored by the same amount or the
 * view jumps to the message they were already reading past.
 */
async function onScroll() {
  const el = scrollArea.value
  if (!el || el.scrollTop > 80 || !chat.hasOlder || chat.loadingOlder) return

  const before = el.scrollHeight
  await chat.loadOlder()
  await nextTick()

  el.scrollTop = el.scrollHeight - before
}

// -- realtime ---------------------------------------------------------------

/**
 * Messages. The channel name is a getter, so navigating between conversations
 * leaves one and joins the next — see useEchoChannel for the leak this avoids.
 */
useEchoChannel(() => (conversationId.value ? `conversation.${conversationId.value}` : null), {
  listeners: {
    '.MessageSent': (message: Message) => {
      chat.receive(message)
      typing.clear(message.sender.id)
      void scrollToBottom()
    },
    '.MessageRead': (payload: { user_id: number; read_at: string; last_read_message_id: number }) =>
      chat.applyReadReceipt(payload),
  },
})

/**
 * Presence and typing, on their own channel name.
 *
 * Separate from the message channel on the server side too, so that hiding your
 * online status keeps you out of the presence set without also cutting off your
 * messages — see routes/channels.php.
 */
const presenceChannel = useEchoChannel(
  () => (conversationId.value ? `conversation.${conversationId.value}.online` : null),
  {
    type: 'presence',
    onHere: (members: PresenceMember[]) =>
      presence.here(members.filter((m) => m.id !== auth.user?.id)),
    onJoining: (member: PresenceMember) => {
      if (member.id !== auth.user?.id) presence.joining(member)
    },
    onLeaving: (member: PresenceMember) => {
      presence.leaving(member)
      typing.clear(member.id)
    },
    whispers: {
      typing: (person: { id: number; name: string }) => {
        if (person.id !== auth.user?.id) typing.onRemoteTyping(person)
      },
    },
  },
)

const typing = useTypingIndicator((person) => presenceChannel.whisper('typing', person))
const typingLabel = typing.label

function onTyping() {
  if (!auth.user) return
  typing.onLocalInput({ id: auth.user.id, name: auth.user.name })
}

// Messages sent while the socket was down were never delivered here.
onEchoReconnect(() => {
  presence.reset()
  typing.reset()
  if (conversationId.value) void load()
})

// -- data -------------------------------------------------------------------

async function send(body: string) {
  await chat.send(body)
  void scrollToBottom()
}

async function retry(message: Message) {
  await chat.retry(message)
  void scrollToBottom()
}

async function load() {
  await chat.open(conversationId.value)
  void scrollToBottom()
}

watch(
  conversationId,
  (id) => {
    if (!id) return

    presence.reset()
    typing.reset()
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <AppLayout>
    <div v-if="chat.loading" class="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <div class="flex items-center gap-3 px-3 md:px-8 py-2.5 border-b border-border bg-surface">
        <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <div class="flex-1 space-y-1.5">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="20%" />
        </div>
      </div>
      <div class="flex-1 p-4 space-y-3">
        <Skeleton v-for="i in 5" :key="i" variant="text" :width="i % 2 ? '55%' : '40%'" height="2.5rem" />
      </div>
    </div>

    <ErrorState v-else-if="chat.hasError" @retry="load" />

    <div v-else-if="chat.active" class="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <ChatHeader
        :conversation="chat.active"
        :online="counterpartOnline"
        :typing-label="typingLabel"
      />

      <ConnectionBanner />

      <ActivityContext v-if="!isGroup" :activities="chat.activities" />

      <div
        ref="scrollArea"
        class="flex-1 overflow-y-auto px-3 md:px-8 py-4 space-y-1.5"
        @scroll.passive="onScroll"
      >
        <p v-if="chat.loadingOlder" class="text-center text-xs text-ink-faint py-2">
          Yuklanmoqda...
        </p>

        <p
          v-else-if="!chat.hasOlder && chat.messages.length > 0"
          class="text-center text-xs text-ink-faint py-2"
        >
          Suhbat boshlanishi
        </p>

        <div v-if="chat.messages.length === 0" class="h-full flex items-center justify-center">
          <p class="text-sm text-ink-muted text-center max-w-xs">
            Hali xabar yo'q. Birinchi bo'lib yozing.
          </p>
        </div>

        <template v-for="row in rows" :key="row.message.id">
          <div v-if="row.daySeparator" class="flex justify-center py-2">
            <span class="text-[11px] text-ink-muted bg-surface border border-border rounded-full px-3 py-1">
              {{ row.daySeparator }}
            </span>
          </div>

          <MessageBubble
            :message="row.message"
            :own="row.own"
            :show-sender="isGroup"
            :show-tail="row.showTail"
            :is-last-read="row.message.id === lastReadOwnMessageId"
            @retry="retry"
          />
        </template>

        <p v-if="typingLabel" class="text-xs text-ink-muted italic px-1 pt-1">
          {{ typingLabel }}
        </p>
      </div>

      <MessageComposer @send="send" @typing="onTyping" />
    </div>
  </AppLayout>
</template>
