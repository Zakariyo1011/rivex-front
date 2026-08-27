<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { MESSAGE_REACTIONS } from '@/types'
import { icons } from '@/lib/icons'

/**
 * The message actions, as a bottom sheet.
 *
 * ## Why a sheet, and not the desktop picker with bigger buttons
 *
 * On a laptop the reply and react controls appear beside a bubble on hover, and
 * the reaction picker is a small floating row. Neither survives a phone:
 *
 *   - There is no hover, so the controls have nothing to appear on.
 *   - A floating row anchored to a bubble near the top of the screen opens off
 *     the top; anchored to one near the right edge it opens off the side. Every
 *     fix for that is a special case.
 *   - A 36px emoji in a floating row is a poor thumb target, and the row sits
 *     wherever the bubble happens to be — which is the middle of the screen,
 *     the hardest place for a thumb to reach.
 *
 * A sheet is the platform answer to all three at once: it is bottom-anchored,
 * so it is always within reach and can never be positioned off-screen; it has
 * the whole screen width to lay out five reactions comfortably; and it names
 * its actions in words rather than relying on the user recognising an icon.
 *
 * ## What is in it
 *
 * The reaction row first — it is the most common action and belongs under the
 * thumb — then Reply, then a quoted line of the message being acted on so it is
 * never ambiguous which one this is. Dismissed by the backdrop, by Escape, and
 * by choosing anything.
 */
defineProps<{
  /** A short preview of the message being acted on. */
  preview: string
  /** The emoji this viewer currently holds, so it reads as chosen. */
  current?: string | null
}>()

const emit = defineEmits<{ react: [string]; reply: []; copy: []; close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // The sheet covers the thread; letting the thread scroll under it is how a
  // dismissal ends up somewhere unexpected.
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="fixed inset-0 z-50 tablet:hidden" role="dialog" aria-modal="true" aria-label="Xabar amallari">
    <!-- The backdrop is the primary way out on a phone: a sheet with only a
         small × is a sheet people get stuck in. -->
    <div class="absolute inset-0 bg-black/40" @click="emit('close')" />

    <div
      class="absolute inset-x-0 bottom-0 bg-surface rounded-t-3xl border-t border-border shadow-2xl"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <!-- Grab handle. Not draggable; it is the affordance that says "this
           came up from the bottom and goes back down". -->
      <div class="flex justify-center pt-2.5 pb-1">
        <span class="w-10 h-1 rounded-full bg-border" />
      </div>

      <p class="px-5 pb-3 text-xs text-ink-faint truncate">{{ preview }}</p>

      <!-- Reactions, spread across the full width. Five of them fit at 375px
           with 56px targets, which is the whole reason the set is five. -->
      <div class="flex items-center justify-between gap-1 px-4 pb-2">
        <button
          v-for="emoji in MESSAGE_REACTIONS"
          :key="emoji"
          type="button"
          class="flex-1 h-14 rounded-2xl flex items-center justify-center text-2xl leading-none transition active:scale-90"
          :class="current === emoji ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-surface-muted'"
          :aria-label="emoji"
          :aria-pressed="current === emoji"
          @click="emit('react', emoji)"
        >
          {{ emoji }}
        </button>
      </div>

      <div class="h-px bg-border mx-4 my-1" />

      <button
        type="button"
        class="w-full h-14 px-5 flex items-center gap-3.5 text-[15px] text-ink hover:bg-surface-muted transition"
        @click="emit('reply')"
      >
        <FontAwesomeIcon :icon="icons.reply" class="text-ink-muted w-5" />
        Javob berish
      </button>

      <!-- Selecting text on a touch screen is a long-press-then-drag-handles
           affair that competes with this very sheet. Copying the whole message
           in one tap is what people actually want, and it is the same action
           the desktop hover row offers. -->
      <button
        type="button"
        class="w-full h-14 px-5 flex items-center gap-3.5 text-[15px] text-ink hover:bg-surface-muted transition"
        @click="emit('copy')"
      >
        <FontAwesomeIcon :icon="icons.copy" class="text-ink-muted w-5" />
        Nusxa olish
      </button>

      <button
        type="button"
        class="w-full h-14 px-5 flex items-center gap-3.5 text-[15px] text-ink-muted hover:bg-surface-muted transition"
        @click="emit('close')"
      >
        <FontAwesomeIcon :icon="icons.close" class="text-ink-faint w-5" />
        Bekor qilish
      </button>
    </div>
  </div>
</template>
