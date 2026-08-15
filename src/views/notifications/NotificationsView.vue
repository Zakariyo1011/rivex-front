<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNotificationsStore } from '@/stores/notifications'
import { notificationPresentation, notificationTarget } from '@/lib/notificationLinks'
import { icons } from '@/lib/icons'
import { timeAgo } from '@/lib/datetime'
import type { AppNotification } from '@/types'

const router = useRouter()
const store = useNotificationsStore()

const hasError = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const tabs = computed(() => [
  { value: 'all', label: 'Barchasi' },
  {
    value: 'unread',
    label: store.unreadCount > 0 ? `O'qilmagan (${store.unreadCount})` : "O'qilmagan",
  },
])

const tone: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface-muted text-ink-muted',
}

async function load() {
  hasError.value = false
  try {
    await store.fetch()
  } catch {
    hasError.value = true
  }
}

async function selectTab(value: string) {
  hasError.value = false
  try {
    await store.setUnreadOnly(value === 'unread')
  } catch {
    hasError.value = true
  }
}

/**
 * Reading and navigating are one gesture. The row is marked read even when it
 * has nowhere to go, so an informational notification still clears the badge.
 */
function open(notification: AppNotification) {
  void store.markRead(notification.id)

  const target = notificationTarget(notification)
  if (target) router.push(target)
}

onMounted(async () => {
  await load()

  // Infinite scroll, with the button below as the accessible fallback.
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) void store.loadMore()
  })

  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Bildirishnomalar</h1>
    </template>

    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <!-- pr-14 clears the notification bell, which AppLayout pins to the
           top-right corner over the page content on small screens. -->
      <div class="flex items-center justify-between gap-3 mb-5 pr-14 tablet:pr-0">
        <h1 class="text-xl md:text-2xl font-bold text-ink">Bildirishnomalar</h1>
        <button
          v-if="store.unreadCount > 0"
          class="text-sm text-primary-600 font-medium hover:underline"
          @click="store.markAllRead()"
        >
          Barchasini o'qildi deb belgilash
        </button>
      </div>

      <AppTabs
        :tabs="tabs"
        :model-value="store.unreadOnly ? 'unread' : 'all'"
        class="mb-5"
        @update:model-value="selectTab"
      />

      <div v-if="store.loading && !store.loaded" class="space-y-3">
        <div v-for="i in 5" :key="i" class="card p-4 flex gap-3">
          <Skeleton variant="circle" width="2.25rem" height="2.25rem" />
          <div class="flex-1 space-y-2">
            <Skeleton variant="text" width="55%" />
            <Skeleton variant="text" width="80%" />
          </div>
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <EmptyState
        v-else-if="store.notifications.length === 0"
        :icon="icons.notifications"
        :title="store.unreadOnly ? 'O\'qilmagan bildirishnoma yo\'q' : 'Hozircha bildirishnoma yo\'q'"
      />

      <div v-else class="space-y-2">
        <button
          v-for="notification in store.notifications"
          :key="notification.id"
          class="w-full text-left card card-hover p-4 flex gap-3 transition"
          :class="{ 'ring-1 ring-primary-200 bg-primary-50/40': !notification.read }"
          @click="open(notification)"
        >
          <span
            class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            :class="tone[notificationPresentation(notification).tone]"
          >
            <FontAwesomeIcon :icon="notificationPresentation(notification).icon" class="text-sm" />
          </span>

          <div class="min-w-0 flex-1">
            <p class="font-semibold text-ink">{{ notification.title }}</p>
            <p class="text-sm text-ink-muted">{{ notification.body }}</p>
            <p class="text-xs text-ink-faint mt-1">{{ timeAgo(notification.created_at) }}</p>
          </div>

          <span
            v-if="!notification.read"
            class="w-2 h-2 rounded-full bg-primary-600 mt-2 shrink-0"
            aria-label="O'qilmagan"
          />
        </button>

        <div ref="sentinel" class="h-px" />

        <div v-if="store.loadingMore" class="py-4 text-center text-sm text-ink-muted">
          Yuklanmoqda...
        </div>
        <button
          v-else-if="store.hasMore"
          class="w-full py-3 text-sm text-primary-600 font-medium"
          @click="store.loadMore()"
        >
          Ko'proq yuklash
        </button>
      </div>
    </div>
  </AppLayout>
</template>
