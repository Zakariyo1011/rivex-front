<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    amount: number
    free?: boolean
  }>(),
  { free: false },
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 font-semibold rounded-full px-2.5 py-1 text-xs"
    :class="free ? 'bg-surface-muted text-ink-muted' : 'bg-primary-50 text-primary-700'"
  >
    <FontAwesomeIcon :icon="free ? icons.free : icons.amount" class="text-[0.85em]" />
    {{ free ? 'Bepul' : `${amount.toLocaleString()} UZS` }}
  </span>
</template>
