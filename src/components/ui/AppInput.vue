<script setup lang="ts">
defineProps<{
  modelValue: string | number
  label?: string
  type?: string
  placeholder?: string
  error?: string
  autocomplete?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="block text-sm font-medium text-ink-secondary mb-1.5">{{ label }}</span>
    <input
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      class="w-full h-12 px-4 rounded-xl border bg-surface text-[15px] outline-none transition focus:ring-2"
      :class="
        error
          ? 'border-danger/40 focus:ring-danger/10 focus:border-danger'
          : 'border-border focus:ring-primary-100 focus:border-primary-400'
      "
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="block text-xs text-danger mt-1">{{ error }}</span>
  </label>
</template>
