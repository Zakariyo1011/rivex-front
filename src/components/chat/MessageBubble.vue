<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import ReactionPicker from '@/components/chat/ReactionPicker.vue'
import { useSwipeReply } from '@/composables/useSwipeReply'
import { icons } from '@/lib/icons'
import { formatTime } from '@/lib/datetime'
import { messagePreviewText } from '@/lib/messagePreview'
import type { Message } from '@/types'
import { userDisplayName } from '@/lib/userLink'

/**
 * One message.
 *
 * Incoming is a white card with a soft border — the language the rest of Rivex
 * uses for "a thing on the page" — and outgoing is solid violet. Both keep the
 * asymmetric corner pointing at their own side.
 *
 * ## Reaching the actions, on two very different inputs
 *
 * A message carries two actions (reply, react) and there is no room to draw
 * either of them permanently: a persistent button row under every bubble turns
 * a conversation into a control panel, and at 375px it would take more width
 * than the message.
 *
 *   both      DRAG THE MESSAGE SIDEWAYS to reply. This is the primary path on
 *             every device — see useSwipeReply for how one gesture serves a
 *             finger and a mouse without either breaking the other.
 *   desktop   reply and react also appear on hover, beside the bubble, on the
 *             side away from the text so they never cover what they belong to.
 *             Kept alongside the drag because a discoverable, clickable control
 *             is what a keyboard and a screen reader can reach.
 *   mobile    long-press for the full sheet (react, and reply again). There is
 *             no hover on a touch screen, and the alternative — a permanently
 *             visible ⋮ on every bubble — spends scarce width on something
 *             wanted once per twenty messages.
 *
 * Long-press is implemented with pointer events rather than `touchstart`, so it
 * also works for a stylus and does not double-fire on hybrid devices. It is
 * cancelled by movement, because a press that turns into a scroll is a scroll —
 * and by the drag gesture claiming the pointer, because a press that turns into
 * a swipe is a swipe.
 */
const props = defineProps<{
  message: Message
  own: boolean
  /** Group threads need to say who is talking; a direct one never does. */
  showSender?: boolean
  /** False when the previous message is from the same person in the same minute. */
  showTail?: boolean
  /** The newest of my messages they have read — carries the receipt for all. */
  isLastRead?: boolean
  /** The emoji this viewer holds on this message, resolved by the store. */
  myReaction?: string | null
}>()

const emit = defineEmits<{
  retry: [Message]
  /** Drop a message that failed to send, rather than leaving it stuck. */
  discard: [Message]
  reply: [Message]
  react: [message: Message, emoji: string]
  /** Tapping a reply preview asks the view to scroll to the original. */
  jump: [number]
  /** Long-pressed on a touch screen: the view opens the action sheet. */
  actions: [Message]
  /** Put this message's text on the clipboard. */
  copy: [Message]
}>()

const state = computed(() => {
  if (props.message.failed) return 'failed'
  if (props.message.pending) return 'pending'
  if (props.message.read_at) return 'read'

  return 'sent'
})

const reactions = computed(() => props.message.reactions ?? [])

/** An optimistic row has no server id yet, so it can be neither replied to nor reacted to. */
const actionable = computed(() => props.message.id > 0 && !props.message.failed)

/**
 * A count that cannot widen the badge without bound.
 *
 * Four digits of reactors would stretch one badge until the row wrapped onto
 * three lines. Nobody needs the exact number past a hundred.
 */
function badgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/**
 * The floating picker is DESKTOP ONLY.
 *
 * On a phone the same two actions are reached through a bottom sheet — see
 * MessageActionSheet for why a floating row anchored to a bubble is the wrong
 * shape on a touch screen. This ref therefore only ever becomes true from the
 * hover controls, which are `hidden tablet:flex`.
 */
const showPicker = ref(false)
const hovered = ref(false)

/** This bubble's root, for the outside-tap test below. */
const root = ref<HTMLElement | null>(null)

function togglePicker() {
  showPicker.value = !showPicker.value
}

/**
 * Close the picker when the next press lands anywhere else.
 *
 * 🔴 Found in browser QA. Each bubble owned its own `showPicker` and nothing
 * ever cleared it, so long-pressing a second message left BOTH pickers open —
 * they accumulated down the conversation, and the only way to close one was to
 * pick an emoji from it. A floating panel with no way out but choosing
 * something is a trap.
 *
 * `pointerdown` rather than `click`, so the panel is gone before the press
 * resolves on whatever is underneath — otherwise dismissing costs two taps on a
 * phone. Bound only while a picker is actually open, so a long conversation is
 * not fifty idle document listeners.
 */
function onDocumentPointerDown(event: PointerEvent) {
  if (root.value?.contains(event.target as Node)) return

  showPicker.value = false
}

watch(showPicker, (open) => {
  if (open) document.addEventListener('pointerdown', onDocumentPointerDown)
  else document.removeEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))

function pick(emoji: string) {
  showPicker.value = false
  emit('react', props.message, emoji)
}

/** Tapping an existing badge toggles that reaction — the fast path. */
function toggleFromBadge(emoji: string) {
  if (!actionable.value) return
  emit('react', props.message, emoji)
}

// -- long press --------------------------------------------------------------

let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressOrigin: { x: number; y: number } | null = null

function startPress(event: PointerEvent) {
  // Mouse users have hover; a long-press with a mouse would also fight
  // text selection, which is a thing people legitimately do to a message.
  if (event.pointerType === 'mouse' || !actionable.value) return

  pressOrigin = { x: event.clientX, y: event.clientY }

  pressTimer = setTimeout(() => {
    // The SHEET, not the floating picker. A phone gets a bottom-anchored sheet
    // with thumb-sized targets; the floating row is for a mouse.
    emit('actions', props.message)
    // A press that opens something should be felt, on the devices that can.
    navigator.vibrate?.(15)
  }, 450)
}

function trackPress(event: PointerEvent) {
  if (!pressOrigin) return

  // 10px of slop: a finger never holds perfectly still, but a press that has
  // travelled further than that is the beginning of a scroll or a swipe and
  // must not become a menu under the reader's thumb.
  const moved =
    Math.abs(event.clientX - pressOrigin.x) > 10 || Math.abs(event.clientY - pressOrigin.y) > 10

  if (moved) cancelPress()
}

function cancelPress() {
  clearTimeout(pressTimer)
  pressTimer = undefined
  pressOrigin = null
}

onBeforeUnmount(cancelPress)

// -- drag to reply -----------------------------------------------------------

/**
 * The gesture, and the three handlers it shares with the long press.
 *
 * Both live on the message column rather than on the bubble alone, so the
 * reaction badges are draggable too — a strip of the message that refuses the
 * gesture reads as the gesture being broken.
 */
const { offset, dragging, progress, armed, iconSide, bindings } = useSwipeReply({
  enabled: () => actionable.value,
  onReply: () => emit('reply', props.message),
  // A pointer that became a swipe was never a long press.
  onClaim: cancelPress,
})

function onPointerDown(event: PointerEvent) {
  bindings.onPointerdown(event)
  startPress(event)
}

/**
 * Only the long press is tracked here; the drag listens on `window`.
 *
 * These stay on the element because touch pointers get implicit capture from
 * the browser, so a finger's moves keep arriving at the bubble they started on
 * — which is exactly the scope a long press wants, and it is only a touch
 * gesture.
 */
function onPointerMove(event: PointerEvent) {
  trackPress(event)
}

function onReplyPreviewClick() {
  const id = props.message.reply_to?.id
  if (id) emit('jump', id)
}
</script>

<template>
  <div ref="root" class="relative">
    <div
      class="flex gap-2 group"
      :class="[own ? 'flex-row-reverse' : 'flex-row', dragging ? '' : 'transition-transform duration-200 ease-out']"
      :style="{ transform: `translate3d(${offset}px, 0, 0)` }"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <!-- Avatar column, group threads only. Kept as a fixed-width spacer even
           when hidden so consecutive bubbles from one person stay aligned. -->
      <div v-if="showSender && !own" class="w-8 shrink-0 self-end">
        <Avatar
          v-if="showTail"
          :src="message.sender.profile?.avatar_url"
          :name="message.sender.name"
          size="sm"
        />
      </div>

      <div
        class="flex flex-col max-w-[78%] sm:max-w-[65%] relative"
        :class="own ? 'items-end' : 'items-start'"
        :style="bindings.style"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="cancelPress"
        @pointercancel="cancelPress"
        @click.capture="bindings.onClickCapture"
      >
        <!-- The reply affordance, revealed from behind the message.
             A child of the moving column rather than of the static row, so it
             travels with the bubble and reads as having been dragged out from
             underneath it. On the side the message is moving away from — the
             only place it is not covered by the thing it belongs to. -->
        <div
          v-if="iconSide"
          class="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          :class="iconSide === 'right' ? 'left-full ml-2' : 'right-full mr-2'"
          :style="{ opacity: progress, transform: `translateY(-50%) scale(${0.6 + progress * 0.4})` }"
          aria-hidden="true"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            :class="armed ? 'bg-primary-600 text-white' : 'bg-surface-muted text-ink-faint border border-border'"
          >
            <FontAwesomeIcon :icon="icons.reply" class="text-xs" />
          </span>
        </div>

        <p
          v-if="showSender && !own && showTail"
          class="text-[11px] font-medium text-ink-muted mb-0.5 px-1"
        >
          {{ userDisplayName(message.sender) }}
        </p>

        <div
          class="px-3.5 py-2 text-[15px] leading-snug transition-opacity select-none touch-manipulation"
          :class="[
            own
              ? 'bg-primary-600 text-white'
              : 'bg-surface text-ink border border-border shadow-sm',
            own
              ? showTail
                ? 'rounded-2xl rounded-br-md'
                : 'rounded-2xl'
              : showTail
                ? 'rounded-2xl rounded-bl-md'
                : 'rounded-2xl',
            message.pending ? 'opacity-60' : '',
            message.failed ? '!bg-danger-bg !text-danger !border-danger/30' : '',
          ]"
          @contextmenu.prevent
        >
          <!-- The quoted original, above the reply's own text.
               A button because it is tappable: it scrolls to the message being
               answered, which is the only way to follow a conversation that has
               branched. Its left rule borrows the bubble's own foreground colour
               so it reads correctly on violet and on white. -->
          <button
            v-if="message.reply_to"
            type="button"
            class="w-full text-left mb-1.5 pl-2 border-l-2 rounded-r-sm py-0.5 transition-opacity hover:opacity-80"
            :class="own ? 'border-white/50 bg-white/10' : 'border-primary-400 bg-primary-50/60'"
            :disabled="message.reply_to.deleted || !message.reply_to.id"
            @click.stop="onReplyPreviewClick"
          >
            <span
              class="block text-[11px] font-semibold truncate"
              :class="own ? 'text-white/85' : 'text-primary-700'"
            >
              {{
                message.reply_to.deleted
                  ? 'Xabar'
                  : userDisplayName(message.reply_to.sender ?? undefined)
              }}
            </span>
            <span
              class="block text-[12px] line-clamp-2 break-words"
              :class="own ? 'text-white/70' : 'text-ink-muted'"
            >
              {{ messagePreviewText(message.reply_to) }}
            </span>
          </button>

          <!-- `break-words` matters more than it looks: a pasted URL with no
               spaces would otherwise push the bubble past the viewport and make
               the whole conversation scroll sideways. -->
          <p class="whitespace-pre-wrap break-words select-text">{{ message.body }}</p>

          <!-- Time and state ride inside the bubble, right-aligned, so a short
               message does not reserve a whole line for two characters. -->
          <span
            class="flex items-center justify-end gap-1 mt-0.5 text-[10px] leading-none"
            :class="own ? 'text-white/70' : 'text-ink-faint'"
          >
            {{ formatTime(message.created_at) }}

            <template v-if="own">
              <FontAwesomeIcon
                v-if="state === 'pending'"
                :icon="icons.time"
                class="text-[9px]"
                aria-label="Yuborilmoqda"
              />
              <FontAwesomeIcon
                v-else-if="state === 'read'"
                :icon="icons.checkDouble"
                class="text-[9px] text-white"
                aria-label="O'qildi"
              />
              <FontAwesomeIcon
                v-else-if="state === 'sent'"
                :icon="icons.check"
                class="text-[9px]"
                aria-label="Yuborildi"
              />
            </template>
          </span>

          <!-- Reaction badges, INSIDE the bubble.
               🔴 The regression this fixes: they used to be a sibling row below
               the bubble, and at a glance that is not "a reaction on this
               message" — it is a second, smaller, unexplained message hanging
               underneath the first one. A reaction is a property of a message,
               and the only way to say so without ambiguity is to draw it within
               the message's own bounds. Being inside also means the bubble's
               width contains them, so no absolute positioning is involved, a
               popular message cannot reach into its neighbours, and incoming
               and outgoing alignment is inherited rather than restated.

               Tapping one toggles this viewer's reaction, which is why they are
               buttons and not decoration — it is the fastest way to agree with
               somebody, and it needs no picker.

               Taller on a phone than on a laptop, deliberately: at 24px these
               were under the touch-target guideline, and a badge that is fiddly
               to hit defeats the point of being the fast path. A mouse is
               precise enough for the compact version. -->
          <div
            v-if="reactions.length"
            class="flex flex-wrap gap-1 mt-1.5"
            :class="own ? 'justify-end' : 'justify-start'"
          >
            <button
              v-for="group in reactions"
              :key="group.emoji"
              type="button"
              class="h-7 tablet:h-6 px-2 tablet:px-1.5 rounded-full text-[11px] leading-none flex items-center gap-1 ring-1 transition"
              :class="
                own
                  ? myReaction === group.emoji
                    ? 'bg-white text-primary-700 ring-white font-semibold'
                    : 'bg-white/15 text-white ring-white/25 hover:bg-white/25'
                  : myReaction === group.emoji
                    ? 'bg-primary-600 text-white ring-primary-600 font-semibold'
                    : 'bg-surface-muted text-ink-muted ring-border hover:ring-primary-300'
              "
              :aria-pressed="myReaction === group.emoji"
              :aria-label="`${group.emoji} ${group.count}`"
              @click.stop="toggleFromBadge(group.emoji)"
            >
              <span class="text-[13px] leading-none">{{ group.emoji }}</span>
              <span class="tabular-nums">{{ badgeCount(group.count) }}</span>
            </button>
          </div>
        </div>

        <!-- A failed send says WHY, then offers the way out.
             "Yuborilmadi" alone is the least useful thing a chat can say: being
             blocked, being rate limited and being offline call for different
             reactions from the sender. The reason comes from the response status
             and carries no backend detail — see describeApiError. -->
        <div v-if="message.failed" class="mt-1 px-1 max-w-full">
          <p class="text-[11px] text-danger leading-snug">
            {{ message.failed_reason ?? 'Yuborilmadi.' }}
          </p>
          <div class="flex items-center gap-3 mt-0.5">
            <button
              type="button"
              class="text-[11px] text-danger font-medium underline underline-offset-2"
              @click="$emit('retry', message)"
            >
              Qayta urinish
            </button>
            <button
              type="button"
              class="text-[11px] text-ink-faint underline underline-offset-2"
              @click="$emit('discard', message)"
            >
              O'chirish
            </button>
          </div>
        </div>

        <span v-else-if="isLastRead" class="text-[10px] text-ink-faint mt-0.5 px-1">
          O'qildi {{ message.read_at ? formatTime(message.read_at) : '' }}
        </span>

        <!-- The picker, anchored to this bubble's own side so it opens inward and
             cannot run off the edge of a 375px screen. -->
        <div
          v-if="showPicker"
          class="absolute z-20 bottom-full mb-1"
          :class="own ? 'right-0' : 'left-0'"
        >
          <ReactionPicker :current="myReaction" @pick="pick" />
        </div>
      </div>

      <!-- Desktop actions. `hidden tablet:flex` because they are hover-driven and
           hover does not exist on the breakpoint below; mobile reaches the same
           two actions by long-pressing the bubble. Rendered as a fixed-width
           column even when invisible so bubbles do not shift on hover. -->
      <div
        class="hidden tablet:flex items-center gap-0.5 self-center shrink-0 transition-opacity"
        :class="hovered || showPicker ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      >
        <template v-if="actionable">
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-ink-faint hover:text-primary-600 hover:bg-surface-muted transition"
            aria-label="Javob berish"
            title="Javob berish"
            @click="$emit('reply', message)"
          >
            <FontAwesomeIcon :icon="icons.reply" class="text-xs" />
          </button>
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-ink-faint hover:text-primary-600 hover:bg-surface-muted transition"
            aria-label="Reaksiya qo'shish"
            title="Reaksiya"
            @click.stop="togglePicker"
          >
            <FontAwesomeIcon :icon="icons.emoji" class="text-xs" />
          </button>
          <!-- Copying a message must not depend on selecting it.
               Dragging a bubble sideways is a reply, and on a mouse that is the
               same axis a selection is made on — so past the drag's slop this
               component takes the drag and the half-made selection is dropped.
               A control that copies the whole message is the honest answer: it
               is what the selection was for nine times out of ten, it works
               identically on a phone (see MessageActionSheet), and it leaves
               double-click-a-word and triple-click-a-line for the tenth. -->
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-ink-faint hover:text-primary-600 hover:bg-surface-muted transition"
            aria-label="Nusxa olish"
            title="Nusxa olish"
            @click.stop="$emit('copy', message)"
          >
            <FontAwesomeIcon :icon="icons.copy" class="text-xs" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
