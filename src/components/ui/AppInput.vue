<script setup lang="ts">
defineProps<{
  modelValue: string
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
    <span v-if="label" class="block text-sm font-medium text-gray-700 mb-1.5">{{ label }}</span>
    <input
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      class="w-full h-12 px-4 rounded-xl border bg-white text-[15px] outline-none transition focus:ring-2"
      :class="
        error
          ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
          : 'border-gray-200 focus:ring-primary-100 focus:border-primary-400'
      "
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="block text-xs text-red-500 mt-1">{{ error }}</span>
  </label>
</template>
