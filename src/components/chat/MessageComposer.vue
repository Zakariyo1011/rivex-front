<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { icons } from '@/lib/icons'

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
const emit = defineEmits<{ send: [string]; typing: [] }>()

defineProps<{ disabled?: boolean; disabledReason?: string | null }>()

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

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div class="border-t border-border bg-surface px-3 md:px-8 py-2.5">
    <p v-if="disabled" class="text-xs text-ink-muted text-center py-2">
      {{ disabledReason ?? 'Bu suhbatga xabar yozib bo‘lmaydi.' }}
    </p>

    <div v-else class="flex items-end gap-2">
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
  </div>
</template>
