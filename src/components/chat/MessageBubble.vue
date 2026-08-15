<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import { icons } from '@/lib/icons'
import { formatTime } from '@/lib/datetime'
import type { Message } from '@/types'
import { userDisplayName } from '@/lib/userLink'

/**
 * One message.
 *
 * The visual problem this replaces: an incoming bubble was `bg-surface-muted`,
 * which is the same token the page background uses — so incoming text sat on a
 * bubble the exact colour of the page behind it and read as bare, colourless
 * text. Outgoing was solid violet. The two sides were not "weakly
 * distinguished"; one of them was invisible.
 *
 * Incoming is now a white card with a soft border, which is the language the
 * rest of Rivex already uses for "a thing on the page". Outgoing stays violet.
 * Both keep the asymmetric corner that points at their own side.
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
}>()

defineEmits<{ retry: [Message] }>()

const state = computed(() => {
  if (props.message.failed) return 'failed'
  if (props.message.pending) return 'pending'
  if (props.message.read_at) return 'read'

  return 'sent'
})
</script>

<template>
  <div class="flex gap-2" :class="own ? 'flex-row-reverse' : 'flex-row'">
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

    <div class="flex flex-col max-w-[78%] sm:max-w-[65%]" :class="own ? 'items-end' : 'items-start'">
      <p
        v-if="showSender && !own && showTail"
        class="text-[11px] font-medium text-ink-muted mb-0.5 px-1"
      >
        {{ userDisplayName(message.sender) }}
      </p>

      <div
        class="px-3.5 py-2 text-[15px] leading-snug transition-opacity"
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
      >
        <!-- `break-words` matters more than it looks: a pasted URL with no
             spaces would otherwise push the bubble past the viewport and make
             the whole conversation scroll sideways. -->
        <p class="whitespace-pre-wrap break-words">{{ message.body }}</p>

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
      </div>

      <button
        v-if="message.failed"
        type="button"
        class="text-[11px] text-danger mt-0.5 px-1 underline underline-offset-2"
        @click="$emit('retry', message)"
      >
        Yuborilmadi — qayta urinish
      </button>

      <span v-else-if="isLastRead" class="text-[10px] text-ink-faint mt-0.5 px-1">
        O'qildi {{ message.read_at ? formatTime(message.read_at) : '' }}
      </span>
    </div>
  </div>
</template>
