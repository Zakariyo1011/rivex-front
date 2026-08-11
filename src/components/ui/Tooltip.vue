<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ text: string }>()
const show = ref(false)
</script>

<template>
  <span class="relative inline-flex" @mouseenter="show = true" @mouseleave="show = false">
    <slot />
    <span
      v-if="show"
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap text-xs font-medium text-white bg-ink px-2.5 py-1.5 rounded-lg shadow-lg z-50"
    >
      {{ text }}
      <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink" />
    </span>
  </span>
</template>
