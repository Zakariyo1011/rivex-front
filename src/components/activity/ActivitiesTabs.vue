<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { activityTabs } from '@/lib/nav'
import { useAuthStore } from '@/stores/auth'

/**
 * The segmented header shared by the three Activities screens.
 *
 * ## Why routes rather than a tabbed component
 *
 * Discover, My Activities and Applications are three screens that already
 * exist, each with its own filters, pagination and error handling. Rendering
 * them as panels inside one parent would mean either lifting all of that into
 * the parent or mounting three heavy views at once — and it would cost the
 * thing that makes them useful: a tab you can link to.
 *
 * `notificationLinks` sends people to `applications`, activity detail links
 * back to it, and the browser's back button has to work across all three. So
 * each tab stays a route and this bar is the only shared piece.
 *
 * The badge reads `auth.counters`, which arrives with `/me` on boot — the same
 * source the bottom bar uses, so the two cannot disagree.
 */
const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()

const badges = computed<Record<string, number>>(() => ({
  pendingApplications: auth.counters?.pending_applications ?? 0,
}))

const tabs = computed(() =>
  activityTabs.map((tab) => ({
    ...tab,
    label: t(tab.labelKey),
    count: tab.badge ? (badges.value[tab.badge] ?? 0) : 0,
    active: route.name === tab.name,
  })),
)

const bar = ref<HTMLElement | null>(null)

/**
 * Keep the current tab on screen.
 *
 * The three labels fit at 375px until a badge appears, at which point the last
 * one is pushed past the edge — and the last one is Applications, which is
 * exactly the tab a badge means you should look at. Scrolling on mount puts it
 * back in view instead of relying on the user to discover that the bar moves.
 */
onMounted(() => {
  bar.value
    ?.querySelector('[aria-current="page"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})
</script>

<template>
  <!-- Scrolls rather than wraps: three Uzbek labels plus a badge do not fit on
       one line at 375px, and a wrapped segmented control reads as two rows of
       unrelated buttons. `no-scrollbar` keeps the affordance quiet on desktop
       where everything fits anyway. -->
  <div ref="bar" class="tab-scroll overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
    <nav class="inline-flex gap-1 p-1 rounded-xl bg-surface-muted min-w-full md:min-w-0 md:w-auto">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="flex-1 md:flex-none whitespace-nowrap inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors"
        :class="
          tab.active
            ? 'bg-surface text-ink shadow-sm'
            : 'text-ink-muted hover:text-ink-secondary'
        "
        :aria-current="tab.active ? 'page' : undefined"
      >
        {{ tab.label }}

        <span
          v-if="tab.count > 0"
          class="min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-primary-600 text-white text-[10px] font-semibold inline-flex items-center justify-center"
          :aria-label="`${tab.count} kutilmoqda`"
        >
          {{ tab.count > 99 ? '99+' : tab.count }}
        </span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
/* The bar scrolls when the labels do not fit; the scrollbar itself would sit
   on top of the tabs on desktop, so it is hidden rather than styled. */
.tab-scroll {
  scrollbar-width: none;
}

.tab-scroll::-webkit-scrollbar {
  display: none;
}
</style>
