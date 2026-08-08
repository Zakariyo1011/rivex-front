<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import { matchesApi } from '@/api/matches'
import { useAuthStore } from '@/stores/auth'
import { getEcho } from '@/composables/useEcho'
import type { ActivityMatch, Message } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const matchId = computed(() => Number(route.params.matchId))
const match = ref<ActivityMatch | null>(null)
const messages = ref<Message[]>([])
const body = ref('')
const loading = ref(true)
const scrollArea = ref<HTMLElement | null>(null)

function otherPerson() {
  if (!match.value) return null
  if (match.value.activity.owner.id !== auth.user?.id) return match.value.activity.owner
  return match.value.participants.find((p) => p.id !== auth.user?.id) ?? match.value.activity.owner
}

async function scrollToBottom() {
  await nextTick()
  scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight })
}

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
    created_at: new Date().toISOString(),
    pending: true,
  }
  messages.value.push(optimistic)
  scrollToBottom()

  try {
    const { data } = await matchesApi.sendMessage(matchId.value, text)
    const index = messages.value.findIndex((m) => m.id === tempId)
    if (index !== -1) messages.value.splice(index, 1)
    if (!messages.value.some((m) => m.id === data.data.id)) {
      messages.value.push(data.data)
      scrollToBottom()
    }
  } catch {
    const optimisticMessage = messages.value.find((m) => m.id === tempId)
    if (optimisticMessage) {
      optimisticMessage.pending = false
      optimisticMessage.failed = true
    }
  }
}

onMounted(async () => {
  const [matchRes, messagesRes] = await Promise.all([
    matchesApi.show(matchId.value),
    matchesApi.messages(matchId.value),
  ])
  match.value = matchRes.data.data
  messages.value = messagesRes.data.data
  loading.value = false
  scrollToBottom()

  matchesApi.markRead(matchId.value)

  getEcho()
    .private(`match.${matchId.value}`)
    .listen('.MessageSent', (message: Message) => {
      if (!messages.value.some((m) => m.id === message.id)) {
        messages.value.push(message)
        scrollToBottom()
        if (message.sender.id !== auth.user?.id) matchesApi.markRead(matchId.value)
      }
    })
})

onUnmounted(() => {
  getEcho().leave(`match.${matchId.value}`)
})
</script>

<template>
  <AppLayout>
    <div v-if="loading" class="p-8 text-center text-ink-faint">Yuklanmoqda...</div>

    <div v-else class="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <div class="flex items-center gap-3 px-4 md:px-8 py-3 border-b border-border bg-white">
        <button class="text-ink-muted text-xl md:hidden" @click="router.push({ name: 'chats' })">←</button>
        <div class="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden">
          <img v-if="otherPerson()?.profile.avatar_url" :src="otherPerson()!.profile.avatar_url!" class="w-full h-full object-cover" />
          <span v-else>{{ otherPerson()?.name[0] }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-ink">{{ otherPerson()?.name }}</p>
          <p class="text-xs text-ink-muted truncate">{{ match?.activity.title }}</p>
        </div>
        <ReportBlockMenu v-if="otherPerson()" :user-id="otherPerson()!.id" :user-name="otherPerson()!.name" />
      </div>

      <div ref="scrollArea" class="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3">
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.sender.id === auth.user?.id ? 'justify-end' : 'justify-start'"
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
        </div>
      </div>

      <div class="px-4 md:px-8 py-3 border-t border-border bg-white flex items-center gap-2">
        <input
          v-model="body"
          type="text"
          placeholder="Xabar yozing..."
          class="flex-1 h-11 rounded-full bg-surface-muted px-4 text-[15px] outline-none"
          @keyup.enter="send"
        />
        <button
          class="w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          :disabled="!body.trim()"
          @click="send"
        >
          ➤
        </button>
      </div>
    </div>
  </AppLayout>
</template>
