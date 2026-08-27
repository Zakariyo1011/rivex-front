<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { icons } from '@/lib/icons'
import { messagePreviewText } from '@/lib/messagePreview'
import { userDisplayName } from '@/lib/userLink'
import type { Message } from '@/types'

/**
 * The message input.
 *
 * A `<textarea>` rather than the `<input>` this replaces, because a message is
 * not a single line and pasting one used to silently flatten it. It grows with
 * the content up to a ceiling, past which it scrolls — an input that can eat
 * the whole viewport on a phone is worse than one that scrolls.
 *
 * Enter sends, Shift+Enter breaks the line. On a touch keyboard Enter inserts a
 * newline instead, because phone keyboards have no Shift+Enter and a send-on-
 * Enter rule there means nobody can ever write a second line.
 */
const emit = defineEmits<{ send: [string]; typing: []; 'cancel-reply': [] }>()

const props = defineProps<{
  disabled?: boolean
  disabledReason?: string | null
  /**
   * The message being answered, if any.
   *
   * Passed in rather than read from the store here so this component stays a
   * dumb input — the view owns which message is being replied to, and the
   * composer only has to draw it and offer a way out.
   */
  replyingTo?: Message | null
}>()

const body = ref('')
const field = ref<HTMLTextAreaElement | null>(null)

const MAX_HEIGHT = 132

function resize() {
  const el = field.value
  if (!el) return

  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
}

function onInput() {
  resize()
  emit('typing')
}

/** Coarse but reliable — no UA sniffing, and it is the property that matters. */
function isTouch(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || isTouch()) return

  // Mid-composition Enter belongs to the IME, not to us.
  if (event.isComposing) return

  event.preventDefault()
  submit()
}

async function submit() {
  const text = body.value.trim()
  if (!text) return

  emit('send', text)
  body.value = ''

  await nextTick()
  resize()
}

/**
 * Focus the field when a reply is started.
 *
 * Choosing "reply" on a bubble is a statement of intent to type, and making the
 * user then tap the field is a second gesture for one decision. On a phone this
 * is also what raises the keyboard, so the reply preview and the keyboard
 * appear together rather than the preview appearing and nothing happening.
 */
watch(
  () => props.replyingTo?.id,
  async (id) => {
    if (id === undefined || id === null) return
    await nextTick()
    field.value?.focus()
  },
)

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div class="border-t border-border bg-surface px-3 md:px-8 py-2.5">
    <p v-if="disabled" class="text-xs text-ink-muted text-center py-2">
      {{ disabledReason ?? 'Bu suhbatga xabar yozib bo‘lmaydi.' }}
    </p>

    <template v-else>
      <!-- The reply being composed, above the field.
           It has to be visible while typing — a reply mode you cannot see is a
           reply mode you forget you are in — and it has to be escapable, which
           is what the × is for.

           Clamped to two lines rather than one. One line was chosen to keep the
           field on screen, but it truncates most real messages mid-word, and a
           quote you cannot read is a quote that does not tell you what you are
           answering. Two lines is the most that fits above a raised keyboard at
           375px, and the clamp is on the text rather than the box so the box
           does not reserve the height when the quote is short.

           A non-text original gets a media chip and a label — see
           messagePreviewText for why an empty quote is not an option. -->
      <div
        v-if="replyingTo"
        class="flex items-start gap-2 mb-2 pl-2 pr-1 py-1.5 rounded-lg bg-surface-muted border-l-2 border-primary-500"
      >
        <FontAwesomeIcon :icon="icons.reply" class="text-[11px] text-primary-500 mt-1 shrink-0" />

        <span
          v-if="replyingTo.type === 'image'"
          class="w-9 h-9 shrink-0 rounded-md bg-surface border border-border flex items-center justify-center text-ink-faint"
          aria-hidden="true"
        >
          <FontAwesomeIcon :icon="icons.image" class="text-xs" />
        </span>

        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-semibold text-primary-700 truncate">
            {{ userDisplayName(replyingTo.sender) }} ga javob
          </p>
          <p class="text-xs text-ink-muted line-clamp-2 break-words">
            {{ messagePreviewText(replyingTo) }}
          </p>
        </div>

        <button
          type="button"
          class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface transition"
          aria-label="Javobni bekor qilish"
          @click="emit('cancel-reply')"
        >
          <FontAwesomeIcon :icon="icons.close" class="text-xs" />
        </button>
      </div>

      <div class="flex items-end gap-2">
      <textarea
        ref="field"
        v-model="body"
        rows="1"
        placeholder="Xabar yozing..."
        aria-label="Xabar matni"
        class="flex-1 resize-none rounded-2xl bg-surface-muted border border-border px-4 py-2.5 text-[15px] leading-snug outline-none focus:border-primary-300 transition-colors max-h-[132px]"
        @input="onInput"
        @keydown="onKeydown"
      />

      <button
        type="button"
        class="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
        :disabled="!body.trim()"
        aria-label="Yuborish"
        @click="submit"
      >
          <FontAwesomeIcon :icon="icons.send" class="text-sm" />
        </button>
      </div>
    </template>
  </div>
</template>
