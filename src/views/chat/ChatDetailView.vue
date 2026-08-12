<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import Avatar from '@/components/ui/Avatar.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ConnectionBanner from '@/components/layout/ConnectionBanner.vue'
import { matchesApi } from '@/api/matches'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel, type PresenceMember } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { usePresence } from '@/composables/usePresence'
import { useTypingIndicator } from '@/composables/useTypingIndicator'
import { icons } from '@/lib/icons'
import { formatTime } from '@/lib/datetime'
import type { ActivityMatch, Message } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const matchId = computed(() => Number(route.params.matchId))
const match = ref<ActivityMatch | null>(null)
const messages = ref<Message[]>([])
const body = ref('')
const loading = ref(true)
const hasError = ref(false)
const scrollArea = ref<HTMLElement | null>(null)

const presence = usePresence()

const otherPerson = computed(() => {
  if (!match.value) return null
  if (match.value.activity.owner.id !== auth.user?.id) return match.value.activity.owner

  return match.value.participants.find((p) => p.id !== auth.user?.id) ?? match.value.activity.owner
})

const otherIsOnline = computed(() => presence.isOnline(otherPerson.value?.id))

/**
 * The last message I sent that the other side has read.
 *
 * Only one tick is shown, on the newest read message, rather than one per
 * bubble — a column of ticks is noise, and what a person actually wants to
 * know is "have they got up to here yet".
 */
const lastReadOwnMessageId = computed(() => {
  const mine = messages.value.filter((m) => m.sender.id === auth.user?.id && m.read_at)

  return mine.at(-1)?.id ?? null
})

async function scrollToBottom() {
  await nextTick()
  scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight })
}

// -- realtime ---------------------------------------------------------------

/**
 * Private channel: the durable events. The channel name is a getter, so
 * navigating /chats/1 -> /chats/2 leaves the first channel and joins the
 * second — the leak that used to render one message four times after
 * A -> B -> A -> B navigation.
 */
useEchoChannel(() => (matchId.value ? `match.${matchId.value}` : null), {
  listeners: {
    '.MessageSent': (message: Message) => {
      if (messages.value.some((m) => m.id === message.id)) return

      messages.value.push(message)
      typing.clear(message.sender.id)
      void scrollToBottom()

      if (message.sender.id !== auth.user?.id) void matchesApi.markRead(matchId.value)
    },
    '.MessageRead': (payload: { user_id: number; read_at: string }) => {
      if (payload.user_id === auth.user?.id) return

      // They have read everything up to now, so every message of mine without
      // a receipt gets one.
      messages.value.forEach((message) => {
        if (message.sender.id === auth.user?.id && !message.read_at) {
          message.read_at = payload.read_at
        }
      })
    },
  },
})

/**
 * Presence channel: who is here, and who is typing.
 *
 * Separate from the private channel because they are different Pusher channels
 * (`presence-match.X` vs `private-match.X`), though one authorisation callback
 * serves both. Typing rides here as a whisper — client to client, never stored.
 */
const presenceChannel = useEchoChannel(
  () => (matchId.value ? `match.${matchId.value}` : null),
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

/** Top-level so the template can read it without `.value`. */
const typingLabel = typing.label

function onInput() {
  if (!auth.user) return
  typing.onLocalInput({ id: auth.user.id, name: auth.user.name })
}

// Messages sent while the socket was down were never delivered here.
onEchoReconnect(() => {
  presence.reset()
  typing.reset()
  if (matchId.value) void load()
})

// -- data -------------------------------------------------------------------

async function send() {
  if (!body.value.trim() || !auth.user) return

  const text = body.value
  body.value = ''

  const tempId = -Date.now()
  const optimistic: Message = {
    id: tempId,
    match_id: matchId.value,
    body: text,
    type: 'text',
    sender: auth.user,
    read_at: null,
    created_at: new Date().toISOString(),
    pending: true,
  }
  messages.value.push(optimistic)
  void scrollToBottom()

  try {
    const { data } = await matchesApi.sendMessage(matchId.value, text)
    const index = messages.value.findIndex((m) => m.id === tempId)
    if (index !== -1) messages.value.splice(index, 1)

    if (!messages.value.some((m) => m.id === data.data.id)) {
      messages.value.push(data.data)
      void scrollToBottom()
    }
  } catch {
    const optimisticMessage = messages.value.find((m) => m.id === tempId)
    if (optimisticMessage) {
      optimisticMessage.pending = false
      optimisticMessage.failed = true
    }
  }
}

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const [matchRes, messagesRes] = await Promise.all([
      matchesApi.show(matchId.value),
      matchesApi.messages(matchId.value),
    ])
    match.value = matchRes.data.data
    messages.value = messagesRes.data.data
    void scrollToBottom()

    void matchesApi.markRead(matchId.value)
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

/**
 * Re-load when the route param changes, not only on mount.
 *
 * Vue Router reuses this component between /chats/1 and /chats/2, so an
 * `onMounted(load)` alone left the previous conversation on screen.
 */
watch(
  matchId,
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
    <div v-if="loading" class="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <div class="flex items-center gap-3 px-4 md:px-8 py-3 border-b border-border bg-surface">
        <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <div class="flex-1 space-y-1.5">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="50%" />
        </div>
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <div v-else class="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <div class="flex items-center gap-3 px-4 md:px-8 py-3 border-b border-border bg-surface">
        <button
          class="text-ink-muted text-lg md:hidden"
          aria-label="Orqaga"
          @click="router.push({ name: 'chats' })"
        >
          <FontAwesomeIcon :icon="icons.back" />
        </button>

        <div class="relative shrink-0">
          <Avatar :src="otherPerson?.profile.avatar_url" :name="otherPerson?.name ?? ''" />
          <span
            v-if="otherIsOnline"
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface"
            aria-label="Onlayn"
          />
        </div>

        <div class="min-w-0 flex-1">
          <p class="font-semibold text-ink">{{ otherPerson?.name }}</p>
          <p v-if="typingLabel" class="text-xs text-primary-600 truncate">
            {{ typingLabel }}
          </p>
          <p v-else-if="otherIsOnline" class="text-xs text-success truncate">Onlayn</p>
          <p v-else class="text-xs text-ink-muted truncate">{{ match?.activity.title }}</p>
        </div>

        <ReportBlockMenu
          v-if="otherPerson"
          :user-id="otherPerson.id"
          :user-name="otherPerson.name"
        />
      </div>

      <ConnectionBanner />

      <div ref="scrollArea" class="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3">
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex flex-col"
          :class="message.sender.id === auth.user?.id ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[15px] transition-opacity"
            :class="[
              message.sender.id === auth.user?.id
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-surface-muted text-ink rounded-bl-md',
              message.pending ? 'opacity-60' : '',
              message.failed ? 'bg-danger-bg text-danger' : '',
            ]"
          >
            {{ message.body }}
            <span v-if="message.failed" class="block text-xs mt-0.5">Yuborilmadi</span>
          </div>

          <span
            v-if="message.id === lastReadOwnMessageId"
            class="text-[11px] text-ink-faint mt-0.5 flex items-center gap-1"
          >
            <FontAwesomeIcon :icon="icons.check" class="text-[9px]" />
            O'qildi {{ message.read_at ? formatTime(message.read_at) : '' }}
          </span>
        </div>

        <p v-if="typingLabel" class="text-xs text-ink-muted italic">
          {{ typingLabel }}
        </p>
      </div>

      <div class="px-4 md:px-8 py-3 border-t border-border bg-surface flex items-center gap-2">
        <input
          v-model="body"
          type="text"
          placeholder="Xabar yozing..."
          class="flex-1 h-11 rounded-full bg-surface-muted px-4 text-[15px] outline-none"
          @input="onInput"
          @keyup.enter="send"
        />
        <button
          class="w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          :disabled="!body.trim()"
          aria-label="Yuborish"
          @click="send"
        >
          <FontAwesomeIcon :icon="icons.send" class="text-sm" />
        </button>
      </div>
    </div>
  </AppLayout>
</template>
