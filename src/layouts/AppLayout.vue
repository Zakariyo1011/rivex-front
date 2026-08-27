<script setup lang="ts">
import { onMounted, useSlots, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import { icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
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
 *
 * ## Where mobile search lives, and why it had to go somewhere
 *
 * 🔴 Global search — the only way to find *people* in this product — had **no
 * mobile entry point at all**. `bottomNavItems` gave up its search slot on the
 * stated grounds that "Home opens with a full-width search field", but Home's
 * field routes to Explore, which browses activities and cannot find a person.
 * So on a phone the search screen existed, worked, and was unreachable.
 *
 * It is not a fifth tab, because 375px does not have a fifth slot worth taking
 * from Explore, Chats or Profile. It is a button in this header, beside the
 * bell — one tap from every screen that draws this bar, which is every screen a
 * person browses from. Desktop keeps its sidebar row, and both go to the same
 * route, so there is one search screen rather than two entry points that drift.
 */
const auth = useAuthStore()
const notifications = useNotificationsStore()
const chat = useChatStore()
const slots = useSlots()
const route = useRoute()

function initForUser() {
  if (!auth.user) return

  notifications.subscribe(auth.user.id)

  // The unread count, read here rather than by the notification page.
  //
  // The badge is drawn on every screen and the page is the one screen where it
  // does not matter — exactly the situation the chat badge below was moved here
  // to fix. It used to be populated as a side effect of opening the bell's
  // dropdown, so once the bell became a link the count stayed at zero until the
  // user visited /notifications.
  void notifications.loadUnreadBadge()

  // The chat badge is read here rather than by the chat list, because the
  // screen that shows the badge is every screen and the one that used to fetch
  // it was the one screen where it does not matter. Signing in on Home used to
  // show no unread count until you visited chat.
  void chat.loadUnreadBadge()
}

onMounted(initForUser)
watch(() => auth.user?.id, initForUser)
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

        <!-- Search, for a breakpoint whose navigation bar has no room for it.
             `v-if` rather than a disabled state: on the search screen itself
             the button would go nowhere, and the input is already right there. -->
        <RouterLink
          v-if="route.name !== 'search'"
          :to="{ name: 'search' }"
          class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-ink-muted hover:text-primary-600 hover:bg-surface-muted transition"
          aria-label="Qidiruv"
        >
          <FontAwesomeIcon :icon="icons.explore" />
        </RouterLink>

        <NotificationBell />
      </div>

      <main class="pb-20 tablet:pb-8 max-w-5xl mx-auto">
        <slot />
      </main>
    </div>

    <BottomNav />
  </div>
</template>
