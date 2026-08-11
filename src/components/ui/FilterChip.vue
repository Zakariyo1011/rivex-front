<script setup lang="ts">
withDefaults(defineProps<{ active?: boolean }>(), { active: false })
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="shrink-0 h-9 px-4 rounded-full text-sm font-medium transition whitespace-nowrap"
    :class="active ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted border border-border hover:bg-surface-muted'"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
