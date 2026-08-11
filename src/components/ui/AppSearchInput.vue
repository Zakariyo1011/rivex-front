<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: 'Qidirish...' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="relative">
    <FontAwesomeIcon :icon="icons.explore" class="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500 text-sm" />
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="w-full h-12 rounded-xl bg-surface border-2 border-primary-200 shadow-sm pl-11 pr-10 text-[15px] outline-none transition focus:ring-2 focus:ring-primary-100 focus:border-primary-400 hover:border-primary-300"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      type="button"
      class="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-muted text-ink-faint flex items-center justify-center"
      @click="emit('update:modelValue', '')"
    >
      <FontAwesomeIcon :icon="icons.close" class="text-[10px]" />
    </button>
  </div>
</template>
