<script setup lang="ts">
import { computed, watch } from 'vue'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'
import { useFollowStore } from '@/stores/follows'
import { icons } from '@/lib/icons'
import type { FollowRelationship } from '@/types'

/**
 * Follow, unfollow, or withdraw a request.
 *
 * ## One source of truth, and why this component stopped being it
 *
 * This button used to own the write, the optimistic update and its rollback,
 * and hand the result back through `update:relationship` for the surrounding
 * screen to store in its own array. Every screen kept its own copy, so
 * following somebody in search and then opening their profile showed "Follow"
 * again — the profile's copy had never heard about the tap.
 *
 * The write now lives in `useFollowStore`, keyed by user id, and every button
 * for the same person reads the same entry. Tapping follow in a search result
 * updates the notification row, the follower list and the profile behind it,
 * because they are all rendering one fact rather than four copies of it.
 *
 * ## The prop and the emit are both still here
 *
 * `relationship` is the server's answer as the *screen* received it, and it
 * seeds the store — a screen usually knows about a person before this button
 * mounts, and the seeded value is what makes the first paint correct rather
 * than empty. `update:relationship` still fires so screens that keep their own
 * list (for a count, or to re-render a row) stay in step. Neither is the source
 * of truth any more; both are how the store and the screen talk.
 */
const props = defineProps<{
  userId: number
  relationship: FollowRelationship
  /** Compact rendering for list rows, where the button sits beside a name. */
  compact?: boolean
}>()

const emit = defineEmits<{ 'update:relationship': [value: FollowRelationship] }>()

const toast = useToast()
const follows = useFollowStore()

/**
 * Value equality over the five fields a relationship has.
 *
 * The prop and the store mirror each other in both directions below, and
 * without this they would ping-pong forever: seeding produces a new object,
 * a new object trips the deep watcher, the watcher seeds again. Comparing by
 * value rather than identity is what makes both directions settle.
 */
function same(a: FollowRelationship | null, b: FollowRelationship | null): boolean {
  if (!a || !b) return a === b

  return (
    a.is_following === b.is_following &&
    a.follow_status === b.follow_status &&
    a.is_followed_by === b.is_followed_by &&
    a.can_follow === b.can_follow &&
    a.follow_needs_approval === b.follow_needs_approval
  )
}

// Prop → store. A screen that refetches (a reload, a page change, a fresh
// search) is delivering a newer server answer, and the newest answer wins.
watch(
  () => props.relationship,
  (value) => {
    if (!same(follows.get(props.userId), value)) follows.seed(props.userId, value)
  },
  { immediate: true, deep: true },
)

/** The store's answer, falling back to the prop while the cache is cold. */
const relationship = computed<FollowRelationship>(
  () => follows.get(props.userId) ?? props.relationship,
)

// Store → prop. The screen around this button often keeps its own copy — a
// follower count to adjust, a list row to re-render — and it has to move with
// the button rather than only at the end of the request. This mirrors every
// store change outward, including the optimistic one and its rollback, which is
// the behaviour the button had when it owned the state itself.
watch(relationship, (value) => {
  if (!same(props.relationship, value)) emit('update:relationship', { ...value })
})

const pending = computed(() => follows.isPending(props.userId))

const isFollowing = computed(() => relationship.value.is_following)
const isRequested = computed(() => relationship.value.follow_status === 'pending')

const label = computed(() => {
  if (isRequested.value) return "So'ralgan"
  if (isFollowing.value) return 'Kuzatilmoqda'
  // "Follow back" is worth saying: it is a different social act from following
  // a stranger, and the person has already shown interest.
  if (relationship.value.is_followed_by) return 'Kuzatish'
  return relationship.value.follow_needs_approval ? "So'rov yuborish" : 'Kuzatish'
})

/** Following and requested are both "already done" states, styled as such. */
const isActiveState = computed(() => isFollowing.value || isRequested.value)

const disabled = computed(
  () => pending.value || (!isActiveState.value && !relationship.value.can_follow),
)

async function toggle() {
  if (disabled.value) return

  try {
    await follows.toggle(props.userId)
  } catch (e) {
    // The store has already rolled its own state back, and the watcher above
    // has already mirrored that rollback out to the screen. All that is left is
    // to say what went wrong.
    toast.error(extractErrorMessage(e))
  }
}
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-60"
    :class="[
      compact ? 'h-8 px-3 text-xs' : 'h-10 px-5 text-sm',
      isActiveState
        ? 'border border-border bg-surface text-ink-secondary hover:border-danger/40 hover:text-danger'
        : 'bg-primary-600 text-white hover:bg-primary-700',
    ]"
    :aria-busy="pending"
    @click="toggle"
  >
    <span
      v-if="pending"
      class="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
    />
    <FontAwesomeIcon
      v-else-if="isFollowing"
      :icon="icons.check"
      class="text-[0.7rem]"
    />
    <FontAwesomeIcon v-else-if="isRequested" :icon="icons.time" class="text-[0.7rem]" />
    {{ label }}
  </button>
</template>
