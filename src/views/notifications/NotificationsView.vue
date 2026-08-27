<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Avatar from '@/components/ui/Avatar.vue'
import FollowButton from '@/components/profile/FollowButton.vue'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationCategoryKey } from '@/api/notifications'
import { notificationPresentation, notificationTarget } from '@/lib/notificationLinks'
import { icons } from '@/lib/icons'
import { timeAgo } from '@/lib/datetime'
import { userProfileRoute } from '@/lib/userLink'
import type { AppNotification, FollowRelationship } from '@/types'

const router = useRouter()
const store = useNotificationsStore()

const hasError = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/**
 * Two independent controls, not one list of five tabs.
 *
 * "Unread" is a *state* and the categories are a *subject*, and people want to
 * combine them — "unread follows" is a real thing to ask for, and a single tab
 * strip cannot express it. So read state is a toggle and the subject is a tab
 * row, and the server composes both filters.
 */
const categories: { value: NotificationCategoryKey; label: string }[] = [
  { value: null, label: 'Barchasi' },
  { value: 'social', label: 'Kuzatuvlar' },
  { value: 'messages', label: 'Xabarlar' },
  { value: 'activities', label: 'Faoliyatlar' },
  { value: 'applications', label: "So'rovlar" },
  { value: 'system', label: 'Tizim' },
]

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

async function selectCategory(value: NotificationCategoryKey) {
  hasError.value = false
  try {
    await store.setCategory(value)
  } catch {
    hasError.value = true
  }
}

async function toggleUnreadOnly() {
  hasError.value = false
  try {
    await store.setUnreadOnly(!store.unreadOnly)
  } catch {
    hasError.value = true
  }
}

/**
 * Leave the notifications screen.
 *
 * Back where there is history, Home otherwise — arriving here from a push or a
 * bookmark leaves nothing behind the back button, and a control that does
 * nothing is worse than no control. Mobile only; desktop has the sidebar.
 */
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'home' })
}

/** Said in the empty state, which has to name both filters that produced it. */
const emptyTitle = computed(() => {
  if (store.unreadOnly) return "O'qilmagan bildirishnoma yo'q"
  if (store.category !== null) return 'Bu turdagi bildirishnoma yo\'q'

  return "Hozircha bildirishnoma yo'q"
})

/**
 * Reading and navigating are one gesture. The row is marked read even when it
 * has nowhere to go, so an informational notification still clears the badge.
 */
function open(notification: AppNotification) {
  void store.markRead(notification.id)

  const target = notificationTarget(notification)
  if (target) router.push(target)
}

/**
 * Rows whose actor can be followed back.
 *
 * The server decides this by sending a `relationship`; the client does not
 * re-derive which types are social, so the two cannot drift apart.
 */
function followable(notification: AppNotification): boolean {
  return !!notification.actor && !!notification.relationship
}

/**
 * The follow state lives on the notification row the server sent, so writing
 * the server's answer back into it is what keeps the button honest after a
 * follow, an unfollow, or a failed attempt that rolled back.
 */
function applyRelationship(notification: AppNotification, next: FollowRelationship) {
  notification.relationship = next
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
    <!--
      A DESTINATION, NOT A DROPDOWN

      The bell used to open a 320px panel holding six rows, with this page
      reachable only by clicking through the bottom of it. Notifications in
      Rivex are actionable — a follow row carries a Follow-back button — and a
      panel anchored inside a 72px sidebar is not somewhere to put a face, a
      handle, a timestamp and a control. The bell is a link now, and this is the
      one place a notification is rendered.

      No `#header` slot. AppLayout's mobile bar carries a search button and the
      bell, and this screen needs neither: it IS the bell's destination, and it
      draws its own header with the back control that a destination needs.
    -->
    <div class="pb-10">
      <!-- Mobile screen header. -->
      <div class="tablet:hidden flex items-center gap-2 px-2 pt-2 pb-1">
        <button
          type="button"
          class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-ink-secondary hover:bg-surface-muted active:bg-surface-muted transition"
          aria-label="Orqaga"
          @click="goBack"
        >
          <FontAwesomeIcon :icon="icons.back" />
        </button>
        <h1 class="text-lg font-bold text-ink flex-1 min-w-0 truncate">Bildirishnomalar</h1>
      </div>

      <div class="px-4 tablet:px-8 pt-2 tablet:pt-10 max-w-2xl desktop:max-w-3xl tablet:mx-auto">
        <!-- Desktop page header, matching Search: a real top-of-page rather
             than a strip under the chrome. -->
        <div class="hidden tablet:flex items-end justify-between gap-3 mb-6">
          <div>
            <h1 class="text-3xl font-bold text-ink tracking-tight">Bildirishnomalar</h1>
            <p class="text-sm text-ink-muted mt-1.5">
              <template v-if="store.unreadCount > 0">
                {{ store.unreadCount }} ta o'qilmagan
              </template>
              <template v-else>Hammasi o'qilgan</template>
            </p>
          </div>
        </div>

        <!-- Filter row: subject on the left, state and bulk action on the
             right. Scrolls horizontally rather than wrapping, so six categories
             at 375px stay one line instead of becoming a block of chips that
             pushes the feed off the screen. -->
        <div class="flex items-center gap-2 mb-3">
          <div class="flex gap-2 overflow-x-auto -mx-4 px-4 tablet:mx-0 tablet:px-0 flex-1 pb-0.5">
            <button
              v-for="tab in categories"
              :key="String(tab.value)"
              type="button"
              class="shrink-0 h-9 px-3.5 rounded-full text-sm font-medium transition"
              :class="
                store.category === tab.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface text-ink-muted border border-border hover:border-primary-300'
              "
              :aria-pressed="store.category === tab.value"
              @click="selectCategory(tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 mb-5">
          <!-- Unread is a toggle, not a tab: it composes with the category
               above rather than replacing it, so "unread follows" is
               expressible.

               `whitespace-nowrap shrink-0` because it wrapped to two lines at
               375px — a pill that breaks mid-phrase reads as a broken control
               rather than a tight one. -->
          <button
            type="button"
            class="h-9 px-3.5 rounded-full text-sm font-medium border transition flex items-center gap-2 whitespace-nowrap shrink-0"
            :class="
              store.unreadOnly
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-surface border-border text-ink-muted hover:border-primary-300'
            "
            :aria-pressed="store.unreadOnly"
            @click="toggleUnreadOnly"
          >
            <span
              class="w-2 h-2 rounded-full"
              :class="store.unreadOnly ? 'bg-primary-600' : 'bg-ink-faint/40'"
            />
            Faqat o'qilmagan
          </button>

          <!-- Two labels for one action. The full sentence and the toggle
               together need more width than a 375px screen has, and the two of
               them squeezed side by side is what made the toggle wrap.
               Shortening the label on the small breakpoint is the honest fix:
               the action is identical, only its name is briefer. -->
          <!-- `h-9` and negative margin: the label is 20px of text, which is
               a poor tap target on a phone. The hit box is a full row tall
               while the text stays where it was. -->
          <button
            v-if="store.unreadCount > 0"
            class="h-9 -my-1 px-1 text-sm text-primary-600 font-medium hover:underline shrink-0 whitespace-nowrap"
            @click="store.markAllRead()"
          >
            <span class="tablet:hidden">Hammasi o'qildi</span>
            <span class="hidden tablet:inline">Barchasini o'qildi deb belgilash</span>
          </button>
        </div>

        <div v-if="store.loading && !store.loaded" class="space-y-2">
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
          :title="emptyTitle"
        />

        <div v-else class="space-y-2">
          <!-- A row, not a button: an actionable notification carries a Follow
               control, and a button inside a button is invalid markup whose
               clicks fight each other. The tappable region is the inner button;
               the action sits outside it. -->
          <div
            v-for="notification in store.notifications"
            :key="notification.id"
            class="card p-4 flex flex-wrap items-start gap-x-3 gap-y-2.5 transition"
            :class="{ 'ring-1 ring-primary-200 bg-primary-50/40': !notification.read }"
          >
            <!-- The actor's face when there is a person behind it, the event
                 icon when there is not. A refund has no avatar and should not
                 borrow one. -->
            <RouterLink
              v-if="notification.actor && userProfileRoute(notification.actor)"
              :to="userProfileRoute(notification.actor)!"
              class="order-1 shrink-0"
              :aria-label="notification.actor.name"
            >
              <Avatar
                :src="notification.actor.profile?.avatar_url"
                :name="notification.actor.name"
                size="sm"
              />
            </RouterLink>
            <Avatar
              v-else-if="notification.actor"
              :src="notification.actor.profile?.avatar_url"
              :name="notification.actor.name"
              size="sm"
              class="order-1 shrink-0"
            />
            <span
              v-else
              class="order-1 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              :class="tone[notificationPresentation(notification).tone]"
            >
              <FontAwesomeIcon :icon="notificationPresentation(notification).icon" class="text-sm" />
            </span>

            <button
              type="button"
              class="order-2 min-w-0 flex-1 text-left"
              @click="open(notification)"
            >
              <p class="font-semibold text-ink">{{ notification.title }}</p>
              <p
                v-if="notification.actor?.username"
                class="text-xs text-ink-faint"
              >
                @{{ notification.actor.username }}
              </p>
              <p class="text-sm text-ink-muted">{{ notification.body }}</p>
              <p class="text-xs text-ink-faint mt-1">{{ timeAgo(notification.created_at) }}</p>
            </button>

            <span
              v-if="!notification.read"
              class="order-3 w-2 h-2 rounded-full bg-primary-600 mt-2 shrink-0 tablet:order-4"
              aria-label="O'qilmagan"
            />

            <!--
              `flex-wrap` with explicit order, not two layouts.

              At 375px the row was avatar + text + a 110px Follow button + the
              unread dot, which left the text about 130px and broke "Yangi
              kuzatuvchi" across two lines on every social row. The action now
              takes a full-width line of its own below the text on a phone
              (indented past the avatar so it reads as belonging to the row) and
              sits inline on tablet and up.

              One FollowButton either way — rendering it twice and hiding one
              per breakpoint would put two controls for the same follow in the
              DOM, reading the same store and both claiming to be the button.
            -->
            <div
              v-if="followable(notification)"
              class="order-4 w-full pl-12 tablet:order-3 tablet:w-auto tablet:pl-0 tablet:self-start"
            >
              <FollowButton
                :user-id="notification.actor!.id"
                :relationship="notification.relationship!"
                compact
                @update:relationship="applyRelationship(notification, $event)"
              />
            </div>
          </div>

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
    </div>
  </AppLayout>
</template>
