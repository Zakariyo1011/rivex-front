<script setup lang="ts">
import AppBadge from './AppBadge.vue'

defineProps<{
  status: string
  labels: Record<string, string>
  variants: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'>
}>()
</script>

<template>
  <AppBadge :variant="variants[status] ?? 'neutral'">{{ labels[status] ?? status }}</AppBadge>
</template>
