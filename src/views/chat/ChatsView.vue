<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ConversationListItem from '@/components/chat/ConversationListItem.vue'
import { useChatStore } from '@/stores/chat'
import { icons } from '@/lib/icons'

const chat = useChatStore()

onMounted(() => {
  // Refetch on every visit rather than only when empty: the list carries unread
  // counts and last messages, both of which go stale the moment the user is
  // elsewhere. The store keeps what it has on screen meanwhile.
  void chat.loadList()
})
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Suhbatlar</h1>
    </template>

    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-2xl pb-8">
      <div class="hidden tablet:flex items-baseline justify-between mb-5">
        <h1 class="text-xl font-bold text-ink">Suhbatlar</h1>
        <span v-if="chat.totalUnread > 0" class="text-sm text-primary-600 font-medium">
          {{ chat.totalUnread }} o'qilmagan
        </span>
      </div>

      <div v-if="chat.listLoading && !chat.listLoaded" class="space-y-2">
        <div v-for="i in 5" :key="i" class="card p-3.5 flex items-center gap-3">
          <Skeleton variant="circle" width="3rem" height="3rem" />
          <div class="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="70%" />
          </div>
        </div>
      </div>

      <ErrorState v-else-if="chat.listError && !chat.listLoaded" @retry="chat.loadList()" />

      <EmptyState
        v-else-if="chat.ordered.length === 0"
        :icon="icons.chat"
        title="Hozircha suhbatlaringiz yo'q"
        description="Kimningdir profiliga kirib «Xabar» tugmasini bosing, yoki faoliyatga qo'shiling."
      />

      <div v-else class="space-y-2">
        <ConversationListItem
          v-for="conversation in chat.ordered"
          :key="conversation.id"
          :conversation="conversation"
        />
      </div>
    </div>
  </AppLayout>
</template>
