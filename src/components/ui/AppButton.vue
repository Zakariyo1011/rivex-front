<script setup lang="ts">
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'outline' | 'ghost' | 'danger'
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    icon?: IconDefinition
  }>(),
  {
    variant: 'primary',
    type: 'button',
    loading: false,
    disabled: false,
  },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="w-full h-12 rounded-xl font-semibold text-[15px] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
    :class="{
      'bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 hover:shadow-lg': variant === 'primary',
      'bg-surface text-primary-700 border border-primary-200 hover:bg-primary-50 hover:border-primary-300': variant === 'outline',
      'bg-transparent text-ink-muted hover:bg-surface-muted': variant === 'ghost',
      'bg-danger text-white hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg': variant === 'danger',
    }"
  >
    <FontAwesomeIcon v-if="loading" :icon="icons.spinner" class="animate-spin" />
    <FontAwesomeIcon v-else-if="icon" :icon="icon" />
    <slot />
  </button>
</template>
