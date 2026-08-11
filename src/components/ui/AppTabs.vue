<script setup lang="ts">
defineProps<{
  tabs: { value: string; label: string }[]
  modelValue: string
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="flex gap-1 p-1 rounded-xl bg-surface-muted">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="flex-1 h-10 rounded-lg text-sm font-semibold transition"
      :class="modelValue === tab.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'"
      @click="$emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
