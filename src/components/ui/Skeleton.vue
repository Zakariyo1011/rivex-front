<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'text' | 'circle' | 'block' | 'card'
    width?: string
    height?: string
  }>(),
  { variant: 'text' },
)
</script>

<template>
  <div
    class="skeleton-shimmer bg-border/70"
    :class="{
      'h-3 rounded-md': variant === 'text',
      'rounded-full': variant === 'circle',
      'rounded-xl': variant === 'block',
      'rounded-2xl h-32': variant === 'card',
    }"
    :style="{ width, height }"
  />
</template>
