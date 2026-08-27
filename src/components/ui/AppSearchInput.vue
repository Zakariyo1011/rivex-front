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
    <!--
      Clear.

      The button is 36px so a thumb can hit it; the visible circle inside stays
      24px so the field looks the same. Separating the target from the mark is
      the standard answer to "this control is the right size visually and the
      wrong size to tap" — at 24px square it was under every touch-target
      guideline, and it sits at the right edge of the screen on a phone, which
      is the hardest place to hit accurately.

      `-mr-1.5` pulls the wider target back so the circle stays where it was.
    -->
    <button
      v-if="modelValue"
      type="button"
      class="absolute right-3 -mr-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center"
      aria-label="Tozalash"
      @click="emit('update:modelValue', '')"
    >
      <span
        class="w-6 h-6 rounded-full bg-surface-muted text-ink-faint flex items-center justify-center"
      >
        <FontAwesomeIcon :icon="icons.close" class="text-[10px]" />
      </span>
    </button>
  </div>
</template>
