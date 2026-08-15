<script setup lang="ts">
import { onMounted, useSlots, watch } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

/**
 * The application shell.
 *
 * ## Where the notification bell lives, and why it moved
 *
 * It used to be rendered here as `position: fixed; top-4 right-4`, which meant
 * it floated over *every* screen in the app regardless of what that screen had
 * in its own top-right corner. In practice it landed on top of the chat
 * header's ⋮ menu, the public profile's ⋮ menu, and the "N o'qilmagan" count on
 * the chat list — three collisions, on the three screens people use most.
 *
 * A floating element that outlives every layout it floats over is not a
 * placement decision, it is the absence of one. So now:
 *
 *   desktop  the bell is a row in the sidebar, beside the other navigation.
 *            Nothing floats; nothing can collide.
 *
 *   mobile   the bell appears only in the header bar below, and that bar only
 *            exists on screens that opt in by filling the `header` slot. A
 *            screen with its own full-width header — a conversation, an
 *            activity — passes nothing and gets nothing.
 *
 * Opt-in rather than opt-out on purpose: a screen added later that forgets to
 * ask for the bell is missing an affordance, which someone notices. Under the
 * old default it would silently inherit an overlay on top of its own controls,
 * which is what happened.
 */
const auth = useAuthStore()
const notifications = useNotificationsStore()
const slots = useSlots()

function initNotifications() {
  if (auth.user) notifications.subscribe(auth.user.id)
}

onMounted(initNotifications)
watch(() => auth.user?.id, initNotifications)
</script>

<template>
  <div class="min-h-screen bg-surface-muted tablet:flex">
    <Sidebar />

    <div class="flex-1 min-w-0">
      <!-- Mobile header bar. Present only when the screen supplies a title,
           so it never appears over a screen that draws its own. -->
      <div
        v-if="slots.header"
        class="tablet:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-surface-muted/95 backdrop-blur border-b border-border/60"
      >
        <div class="min-w-0 flex-1">
          <slot name="header" />
        </div>
        <NotificationBell />
      </div>

      <main class="pb-20 tablet:pb-8 max-w-5xl mx-auto">
        <slot />
      </main>
    </div>

    <BottomNav />
  </div>
</template>
