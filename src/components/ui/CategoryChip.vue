<script setup lang="ts">
import { categoryIcon } from '@/lib/icons'

withDefaults(defineProps<{ slug: string; label: string; active?: boolean }>(), { active: false })
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="shrink-0 h-9 px-3.5 rounded-full text-sm font-medium transition flex items-center gap-1.5"
    :class="active ? 'bg-primary-100 text-primary-700' : 'bg-surface-muted text-ink-muted hover:bg-border'"
    @click="$emit('click')"
  >
    <FontAwesomeIcon :icon="categoryIcon(slug)" class="text-xs" />
    {{ label }}
  </button>
</template>
