<script setup lang="ts">
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

defineProps<{
  icon?: IconDefinition
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-12 px-6">
    <div
      v-if="icon"
      class="w-14 h-14 rounded-2xl bg-surface-muted text-ink-faint flex items-center justify-center text-xl mb-4"
    >
      <FontAwesomeIcon :icon="icon" />
    </div>
    <p class="font-semibold text-ink">{{ title }}</p>
    <p v-if="description" class="text-sm text-ink-muted mt-1 max-w-xs">{{ description }}</p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
