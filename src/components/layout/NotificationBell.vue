<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import EmptyState from '@/components/ui/EmptyState.vue'
import { notificationPresentation, notificationTarget } from '@/lib/notificationLinks'
import { icons } from '@/lib/icons'
import { timeAgo } from '@/lib/datetime'
import type { AppNotification } from '@/types'

/**
 * Where this bell is being rendered.
 *
 * `floating` is the round bordered button used in the mobile header bar;
 * `nav` is a full-width row that matches the desktop sidebar's other entries.
 * The dropdown has to be anchored differently in each — a right-aligned panel
 * inside a 72px sidebar opens off the edge of the screen.
 */
const props = withDefaults(defineProps<{ variant?: 'floating' | 'nav' }>(), {
  variant: 'floating',
})

const router = useRouter()
const { t } = useI18n()
const store = useNotificationsStore()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

/** The dropdown is a peek at the top of the list, not a second list. */
const preview = computed(() => store.notifications.slice(0, 6))

const tone: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface-muted text-ink-muted',
}

function toggle() {
  open.value = !open.value
  if (open.value && !store.loaded) void store.fetch()
}

function onNotificationClick(notification: AppNotification) {
  void store.markRead(notification.id)
  open.value = false

  const target = notificationTarget(notification)
  if (target) router.push(target)
}

function seeAll() {
  open.value = false
  router.push({ name: 'notifications' })
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
      v-if="props.variant === 'nav'"
      class="w-full relative flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-medium text-ink-muted hover:bg-surface-muted transition justify-center desktop:justify-start"
      :aria-label="t('notifications.title')"
      @click="toggle"
    >
      <span class="relative shrink-0">
        <FontAwesomeIcon :icon="icons.notifications" class="text-base" />
        <span
          v-if="store.unreadCount > 0"
          class="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center"
        >
          {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
        </span>
      </span>
      <span class="hidden desktop:inline">{{ t('notifications.title') }}</span>
    </button>

    <button
      v-else
      class="w-10 h-10 rounded-full bg-surface border border-border shadow-sm flex items-center justify-center relative shrink-0 text-ink-secondary hover:border-primary-300 hover:text-primary-600 transition"
      :aria-label="t('notifications.title')"
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
        class="absolute mt-2 w-80 max-h-96 overflow-y-auto bg-surface rounded-2xl shadow-lg border border-border z-50"
        :class="props.variant === 'nav' ? 'left-0' : 'right-0'"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <span class="font-semibold text-ink">{{ t('notifications.title') }}</span>
          <button
            v-if="store.unreadCount > 0"
            class="text-xs text-primary-600 font-medium"
            @click.stop="store.markAllRead()"
          >
            {{ t('notifications.markAllRead') }}
          </button>
        </div>

        <EmptyState
          v-if="store.notifications.length === 0"
          :icon="icons.notifications"
          :title="t('notifications.empty')"
        />

        <template v-else>
          <button
            v-for="notification in preview"
            :key="notification.id"
            class="w-full text-left px-4 py-3 border-b border-border flex gap-3 hover:bg-surface-muted transition"
            :class="{ 'bg-primary-50/50': !notification.read }"
            @click="onNotificationClick(notification)"
          >
            <span
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              :class="tone[notificationPresentation(notification).tone]"
            >
              <FontAwesomeIcon
                :icon="notificationPresentation(notification).icon"
                class="text-xs"
              />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink">{{ notification.title }}</p>
              <p class="text-sm text-ink-muted line-clamp-2">{{ notification.body }}</p>
              <p class="text-xs text-ink-faint mt-0.5">{{ timeAgo(notification.created_at) }}</p>
            </div>
            <span
              v-if="!notification.read"
              class="w-2 h-2 rounded-full bg-primary-600 mt-2 shrink-0"
            />
          </button>

          <button
            class="w-full py-3 text-sm text-primary-600 font-medium hover:bg-surface-muted transition"
            @click="seeAll"
          >
            {{ t('notifications.seeAll') }}
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>
