<script setup lang="ts">
import { MESSAGE_REACTIONS } from '@/types'

/**
 * The five reactions, in a row.
 *
 * ## Why five and not an emoji keyboard
 *
 * A picker that fits on one line of a 375px screen without scrolling is a
 * picker people use. The long tail of emoji is a search box wearing a
 * reaction's clothes, and it is a different feature with a different UI. Five
 * also means the row never needs horizontal scrolling, which is the thing that
 * breaks reaction pickers on phones.
 *
 * ## Positioning is the caller's problem, deliberately
 *
 * This renders a plain row and takes no view on where it sits. An outgoing
 * bubble needs it anchored right and an incoming one left, and a bubble near
 * the top of the viewport needs it below rather than above — none of which this
 * component can see. It stays a row so the bubble can place it.
 */
defineProps<{
  /** The emoji this user currently holds, so it can be shown as chosen. */
  current?: string | null
}>()

const emit = defineEmits<{ pick: [string]; dismiss: [] }>()
</script>

<template>
  <div
    class="flex items-center gap-0.5 p-1 rounded-full bg-surface border border-border shadow-lg"
    role="group"
    aria-label="Reaksiya tanlang"
    @click.stop
  >
    <button
      v-for="emoji in MESSAGE_REACTIONS"
      :key="emoji"
      type="button"
      class="w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none transition hover:bg-surface-muted active:scale-90"
      :class="current === emoji ? 'bg-primary-50 ring-1 ring-primary-300' : ''"
      :aria-pressed="current === emoji"
      :aria-label="emoji"
      @click="emit('pick', emoji)"
    >
      {{ emoji }}
    </button>
  </div>
</template>
