<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
    size?: 'sm' | 'md'
  }>(),
  { variant: 'neutral', size: 'md' },
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-semibold rounded-full"
    :class="[
      size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      {
        'bg-primary-50 text-primary-700': variant === 'primary',
        'bg-success-bg text-success': variant === 'success',
        'bg-warning-bg text-warning': variant === 'warning',
        'bg-danger-bg text-danger': variant === 'danger',
        'bg-surface-muted text-ink-muted': variant === 'neutral',
      },
    ]"
  >
    <slot />
  </span>
</template>
