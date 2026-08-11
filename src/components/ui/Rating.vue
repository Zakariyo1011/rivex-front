<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    value: number
    count?: number
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)
</script>

<template>
  <span class="inline-flex items-center gap-1 text-star font-semibold" :class="size === 'sm' ? 'text-sm' : 'text-base'">
    <FontAwesomeIcon :icon="icons.starSolid" class="text-[0.85em]" />
    {{ value.toFixed(1) }}
    <span v-if="count !== undefined" class="text-ink-faint font-normal">({{ count }})</span>
  </span>
</template>
