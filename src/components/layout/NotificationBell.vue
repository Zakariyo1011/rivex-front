<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import EmptyState from '@/components/ui/EmptyState.vue'
import { icons } from '@/lib/icons'
import type { AppNotification } from '@/types'

const router = useRouter()
const { t } = useI18n()
const store = useNotificationsStore()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
  if (open.value && !store.loaded) store.fetch()
}

function onNotificationClick(notification: AppNotification) {
  store.markRead(notification.id)
  open.value = false

  const activityId = notification.data.activity_id as number | undefined
  if (activityId) router.push({ name: 'activity-detail', params: { id: activityId } })
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'hozir'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daq oldin`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`
  return `${Math.floor(seconds / 86400)} kun oldin`
}

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="w-10 h-10 rounded-full bg-surface border-2 border-primary-200 shadow-sm flex items-center justify-center relative shrink-0 text-primary-600 hover:border-primary-400 hover:shadow-md transition"
      @click="toggle"
    >
      <FontAwesomeIcon :icon="icons.notifications" />
      <span
        v-if="store.unreadCount > 0"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </button>

    <Transition name="dropdown">
      <div
        v-if="open"
        class="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface rounded-2xl shadow-lg border border-border z-50"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <span class="font-semibold text-ink">{{ t('notifications.title') }}</span>
          <button v-if="store.unreadCount > 0" class="text-xs text-primary-600 font-medium" @click="store.markAllRead">
            {{ t('notifications.markAllRead') }}
          </button>
        </div>

        <EmptyState v-if="store.notifications.length === 0" :icon="icons.notifications" :title="t('notifications.empty')" />

        <button
          v-for="notification in store.notifications"
          :key="notification.id"
          class="w-full text-left px-4 py-3 border-b border-border last:border-0 flex gap-3 hover:bg-surface-muted transition"
          :class="{ 'bg-primary-50/50': !notification.read }"
          @click="onNotificationClick(notification)"
        >
          <span
            class="w-2 h-2 rounded-full mt-2 shrink-0"
            :class="notification.read ? 'bg-transparent' : 'bg-primary-600'"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink">{{ notification.title }}</p>
            <p class="text-sm text-ink-muted line-clamp-2">{{ notification.body }}</p>
            <p class="text-xs text-ink-faint mt-0.5">{{ timeAgo(notification.created_at) }}</p>
          </div>
        </button>
      </div>
    </Transition>
  </div>
</template>
