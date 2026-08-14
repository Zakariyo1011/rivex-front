<script setup lang="ts">
import { computed, ref } from 'vue'
import { followsApi } from '@/api/follows'
import { extractErrorMessage } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'
import { icons } from '@/lib/icons'
import type { FollowRelationship } from '@/types'

/**
 * Follow, unfollow, or withdraw a request.
 *
 * ## Optimism, with a real rollback
 *
 * The button flips before the request resolves, because a follow tap that sits
 * inert for 300ms reads as broken. That is only honest if the failure path
 * actually restores the previous state — an optimistic update without a
 * rollback is not optimism, it is a lie that happens to be true most of the
 * time. So the prior relationship is captured before mutating, restored on any
 * error, and the server's own answer replaces the guess on success.
 *
 * The server is authoritative in both directions: a follow of a private account
 * comes back `pending`, not `accepted`, and the optimistic guess is discarded
 * rather than merged.
 */
const props = defineProps<{
  userId: number
  relationship: FollowRelationship
  /** Compact rendering for list rows, where the button sits beside a name. */
  compact?: boolean
}>()

const emit = defineEmits<{ 'update:relationship': [value: FollowRelationship] }>()

const toast = useToast()
const pending = ref(false)

const isFollowing = computed(() => props.relationship.is_following)
const isRequested = computed(() => props.relationship.follow_status === 'pending')

const label = computed(() => {
  if (isRequested.value) return "So'ralgan"
  if (isFollowing.value) return 'Kuzatilmoqda'
  // "Follow back" is worth saying: it is a different social act from following
  // a stranger, and the person has already shown interest.
  if (props.relationship.is_followed_by) return 'Kuzatish'
  return props.relationship.follow_needs_approval ? "So'rov yuborish" : 'Kuzatish'
})

/** Following and requested are both "already done" states, styled as such. */
const isActiveState = computed(() => isFollowing.value || isRequested.value)

const disabled = computed(
  () => pending.value || (!isActiveState.value && !props.relationship.can_follow),
)

async function toggle() {
  if (disabled.value) return

  const previous = { ...props.relationship }
  const undoing = isActiveState.value

  pending.value = true

  // The optimistic guess. `can_follow` is set false while following so a second
  // tap cannot start a duplicate request before the first resolves.
  emit('update:relationship', {
    ...previous,
    is_following: undoing ? false : !previous.follow_needs_approval,
    follow_status: undoing ? null : previous.follow_needs_approval ? 'pending' : 'accepted',
    can_follow: undoing,
  })

  try {
    const { data } = undoing
      ? await followsApi.unfollow(props.userId)
      : await followsApi.follow(props.userId)

    // The server's answer, not the guess — it knows whether approval was
    // needed, and it may disagree.
    emit('update:relationship', data.data)
  } catch (e) {
    emit('update:relationship', previous)
    toast.error(extractErrorMessage(e))
  } finally {
    pending.value = false
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
