<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import { icons } from '@/lib/icons'

/**
 * The notification entry point.
 *
 * ## It used to be a dropdown, and that was the problem
 *
 * Tapping this opened an 80-wide panel holding six rows and a "see all" link at
 * the bottom. That made notifications a *peek* — a thing you glance at from the
 * navigation — while the real screen at `/notifications` was somewhere you
 * ended up only by scrolling to the bottom of the peek and clicking through.
 *
 * Two costs, and the second is the one that decided this:
 *
 *   - Notifications in Rivex are actionable. A follow row carries a Follow-back
 *     button, and a 320px panel anchored inside a 72px sidebar is a poor place
 *     to put a button, a face, a handle and a timestamp. Rows were cramped in
 *     the peek and comfortable on the page, so the two surfaces disagreed about
 *     what a notification even looks like.
 *   - It was two renderings of one list. Every change — categories, read state,
 *     the follow button — had to be made twice or the two would drift, and they
 *     had already drifted: the panel had no unread filter and no categories.
 *
 * So this is now a link. One tap, one screen, one rendering of a notification.
 * The badge still lives here because the count is the thing you want from
 * anywhere; the *content* lives on the page that has room for it.
 *
 * The store is untouched by this change — it was already shared, which is why
 * the badge and the page have never disagreed about the count.
 */
const props = withDefaults(defineProps<{ variant?: 'floating' | 'nav' }>(), {
  variant: 'floating',
})

const route = useRoute()
const { t } = useI18n()
const store = useNotificationsStore()

const isActive = computed(() => route.name === 'notifications')

/** Two digits is all that fits; past that the exact number stops mattering. */
const badge = computed(() => (store.unreadCount > 9 ? '9+' : String(store.unreadCount)))

const badgeLabel = computed(() => `${store.unreadCount} o'qilmagan bildirishnoma`)
</script>

<template>
  <!-- Sidebar row. Matches the other navigation entries exactly, including the
       active rail, because it IS one now rather than a control that happens to
       live among them. -->
  <RouterLink
    v-if="props.variant === 'nav'"
    :to="{ name: 'notifications' }"
    class="relative w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-medium transition justify-center desktop:justify-start"
    :class="isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:bg-surface-muted'"
    :aria-label="t('notifications.title')"
  >
    <span
      v-if="isActive"
      class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary-600"
    />
    <span class="relative shrink-0">
      <FontAwesomeIcon :icon="icons.notifications" class="text-base" />
      <!-- Pinned to the icon while the label is hidden (tablet), so a collapsed
           sidebar still carries the count. -->
      <span
        v-if="store.unreadCount > 0"
        class="desktop:hidden absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center"
        :aria-label="badgeLabel"
      >
        {{ badge }}
      </span>
    </span>
    <span class="hidden desktop:inline">{{ t('notifications.title') }}</span>

    <!-- Expanded, the count belongs at the end of the row beside the name
         rather than on top of the icon — the same two positions the chat
         badge uses in this sidebar. -->
    <span
      v-if="store.unreadCount > 0"
      class="hidden desktop:flex ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-semibold items-center justify-center"
      :aria-label="badgeLabel"
    >
      {{ badge }}
    </span>
  </RouterLink>

  <!-- Mobile header button. -->
  <RouterLink
    v-else
    :to="{ name: 'notifications' }"
    class="w-10 h-10 rounded-full flex items-center justify-center relative shrink-0 transition"
    :class="
      isActive
        ? 'bg-primary-50 text-primary-600'
        : 'text-ink-secondary hover:text-primary-600 hover:bg-surface-muted'
    "
    :aria-label="t('notifications.title')"
  >
    <FontAwesomeIcon :icon="icons.notifications" />
    <span
      v-if="store.unreadCount > 0"
      class="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center"
      :aria-label="badgeLabel"
    >
      {{ badge }}
    </span>
  </RouterLink>
</template>
