<script setup lang="ts">
import { icons } from '@/lib/icons'

defineProps<{
  label: string
  distanceKm?: number
}>()
</script>

<template>
  <span class="inline-flex items-center gap-1 text-sm text-ink-muted">
    <FontAwesomeIcon :icon="icons.location" class="text-xs text-ink-faint" />
    {{ label }}
    <span v-if="distanceKm !== undefined">· {{ distanceKm }} km</span>
  </span>
</template>
