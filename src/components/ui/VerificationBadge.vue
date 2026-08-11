<script setup lang="ts">
import { icons } from '@/lib/icons'
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="inline-flex items-center gap-1 text-primary-600 font-medium" :class="compact ? 'text-xs' : 'text-sm'">
    <FontAwesomeIcon :icon="icons.verified" />
    <span v-if="!compact">Tasdiqlangan</span>
  </span>
</template>
