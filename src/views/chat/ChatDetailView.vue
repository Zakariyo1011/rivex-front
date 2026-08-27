<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ConnectionBanner from '@/components/layout/ConnectionBanner.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageComposer from '@/components/chat/MessageComposer.vue'
import MessageActionSheet from '@/components/chat/MessageActionSheet.vue'
import ActivityContext from '@/components/chat/ActivityContext.vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel, type PresenceMember } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { usePresence } from '@/composables/usePresence'
import { useTypingIndicator } from '@/composables/useTypingIndicator'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/lib/datetime'
import { messagePreviewText } from '@/lib/messagePreview'
import type { Message } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const chat = useChatStore()
const toast = useToast()

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

    /**
     * Somebody reacted, changed their reaction, or took it back.
     *
     * A delta rather than the message's whole reaction list, so a popular
     * message does not re-send every reactor to every participant on each tap.
     * The store applies it idempotently — a frame delivered twice across a
     * reconnect must not double-count.
     */
    '.MessageReactionChanged': (payload: {
      message_id: number
      user_id: number
      emoji: string | null
      previous_emoji: string | null
    }) => chat.receiveReaction(payload),
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

// -- replies ----------------------------------------------------------------

/**
 * Scroll to the message a reply is answering, and say which one it was.
 *
 * The highlight is the point. Scrolling alone drops the reader somewhere in the
 * history with no indication of which message they were sent to — in a run of
 * similar messages that is no help at all. The ring fades on its own rather
 * than needing to be dismissed.
 *
 * When the original is not loaded — it is older than the pages fetched so far —
 * this says so instead of scrolling nowhere. Deliberately NOT a fetch: paging
 * backwards until the message turns up could be many requests for a message
 * from last month, and a spinner that runs for ten seconds after a tap is worse
 * than an honest "scroll up to find it".
 */
const highlightedId = ref<number | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined

/**
 * How many extra pages to fetch looking for an original that is not loaded.
 *
 * Bounded, and low. Paging backwards until the message turns up could be many
 * requests for a message from last month, and a spinner that runs for ten
 * seconds after a tap is worse than an honest "scroll up to find it". Three
 * pages is 150 messages, which covers the overwhelming majority of taps — you
 * reply to something you can still remember — and costs at most three requests
 * before this gives up and says so.
 */
const JUMP_PAGE_BUDGET = 3

async function jumpToMessage(id: number) {
  let found = chat.messages.some((m) => m.id === id)

  // Not loaded yet: reach back a little way for it rather than refusing on the
  // first try. `hasOlder` stops this at the top of the thread, so a message
  // that genuinely is not there costs fewer than the budget.
  for (let page = 0; !found && page < JUMP_PAGE_BUDGET && chat.hasOlder; page += 1) {
    await chat.loadOlder()
    found = chat.messages.some((m) => m.id === id)
  }

  if (!found) {
    toast.info("Asl xabar hali yuklanmagan — yuqoriga suring.")

    return
  }

  await nextTick()

  const el = scrollArea.value?.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
  if (!el) return

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  highlightedId.value = id
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => (highlightedId.value = null), 1600)
}

onBeforeUnmount(() => clearTimeout(highlightTimer))

function onReact(message: Message, emoji: string) {
  void chat.toggleReaction(message, emoji)
}

// -- mobile actions ---------------------------------------------------------

/**
 * The message a long press opened the action sheet for.
 *
 * Held by the view rather than the bubble so there is exactly one sheet in the
 * DOM. A sheet per bubble would mean fifty fixed-position overlays in a long
 * thread, and two of them could be open at once.
 */
const actionTarget = ref<Message | null>(null)

function openActions(message: Message) {
  actionTarget.value = message
}

function closeActions() {
  actionTarget.value = null
}

/**
 * Put a message's text on the clipboard.
 *
 * Offered as an explicit action rather than left to text selection, because
 * dragging a bubble sideways is a reply and on a mouse that is the same axis a
 * selection is made on — see MessageBubble. The toast is not decoration: a copy
 * that succeeds silently is indistinguishable from one that did nothing.
 *
 * `writeText` rejects when the document is not focused or the permission is
 * refused, and on a page served over plain http in some browsers. Those are
 * ordinary conditions rather than bugs, so they are reported as a failure the
 * user can act on instead of being swallowed.
 */
async function copyMessage(message: Message) {
  const text = message.body?.trim()
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
    toast.success('Nusxa olindi.')
  } catch {
    toast.error('Nusxa olib bo‘lmadi.')
  }
}

function copyFromSheet() {
  const message = actionTarget.value
  closeActions()
  if (message) void copyMessage(message)
}

function reactFromSheet(emoji: string) {
  const message = actionTarget.value
  closeActions()
  if (message) void chat.toggleReaction(message, emoji)
}

function replyFromSheet() {
  const message = actionTarget.value
  closeActions()
  if (message) chat.startReply(message)
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

      <!-- `overflow-x-hidden` is load-bearing, not tidiness.
           Dragging a message to reply translates it sideways, and a message
           already against its own edge of the screen travels past it. Without
           this the page itself gains a horizontal scrollbar mid-gesture and the
           whole conversation shifts. `overscroll-x-contain` is the other half:
           it keeps a horizontal fling from being handed to the browser as a
           back-navigation. -->
      <div
        ref="scrollArea"
        class="flex-1 overflow-y-auto overflow-x-hidden overscroll-x-contain px-3 md:px-8 py-4 space-y-1.5"
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

          <!-- `data-message-id` is what `jumpToMessage` looks up when a reply
               preview is tapped. A DOM query rather than a ref-per-message: the
               list is virtual-length and refs would mean one reactive binding
               per bubble to serve a lookup that happens on a deliberate tap. -->
          <div
            :data-message-id="row.message.id"
            class="rounded-2xl transition-shadow duration-500"
            :class="
              highlightedId === row.message.id
                ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-surface-muted'
                : ''
            "
          >
            <MessageBubble
              :message="row.message"
              :own="row.own"
              :show-sender="isGroup"
              :show-tail="row.showTail"
              :is-last-read="row.message.id === lastReadOwnMessageId"
              :my-reaction="chat.myReaction(row.message)"
              @retry="retry"
              @discard="chat.discardFailed"
              @reply="chat.startReply"
              @react="onReact"
              @jump="jumpToMessage"
              @actions="openActions"
              @copy="copyMessage"
            />
          </div>
        </template>

        <p v-if="typingLabel" class="text-xs text-ink-muted italic px-1 pt-1">
          {{ typingLabel }}
        </p>
      </div>

      <!-- One sheet for the whole thread — see `actionTarget`. -->
      <MessageActionSheet
        v-if="actionTarget"
        :preview="messagePreviewText(actionTarget)"
        :current="chat.myReaction(actionTarget)"
        @react="reactFromSheet"
        @reply="replyFromSheet"
        @copy="copyFromSheet"
        @close="closeActions"
      />

      <MessageComposer
        :replying-to="chat.replyingTo"
        @send="send"
        @typing="onTyping"
        @cancel-reply="chat.cancelReply"
      />
    </div>
  </AppLayout>
</template>
