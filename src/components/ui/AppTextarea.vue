<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    placeholder?: string
    error?: string
    rows?: number
  }>(),
  { rows: 3 },
)

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="block text-sm font-medium text-ink-secondary mb-1.5">{{ label }}</span>
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      class="w-full rounded-xl border bg-surface text-[15px] p-3 outline-none transition focus:ring-2 resize-none"
      :class="
        error
          ? 'border-danger/40 focus:ring-danger/10 focus:border-danger'
          : 'border-border focus:ring-primary-100 focus:border-primary-400'
      "
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <span v-if="error" class="block text-xs text-danger mt-1">{{ error }}</span>
  </label>
</template>
