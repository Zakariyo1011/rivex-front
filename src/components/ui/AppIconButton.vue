<script setup lang="ts">
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

withDefaults(
  defineProps<{
    icon: IconDefinition
    label: string
    variant?: 'ghost' | 'solid' | 'outline'
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { variant: 'ghost', size: 'md' },
)
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    class="rounded-full flex items-center justify-center transition shrink-0"
    :class="[
      size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm',
      {
        'bg-surface-muted text-ink-muted hover:bg-border': variant === 'ghost',
        'bg-primary-600 text-white hover:bg-primary-700': variant === 'solid',
        'bg-surface text-ink-muted border border-border hover:bg-surface-muted': variant === 'outline',
      },
    ]"
  >
    <FontAwesomeIcon :icon="icon" />
  </button>
</template>
