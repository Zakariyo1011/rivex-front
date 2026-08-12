<script setup lang="ts">
import { ref } from 'vue'
import { icons } from '@/lib/icons'

/**
 * Star picker for 1–5.
 *
 * A sibling of `Rating.vue` rather than an extension of it: that one renders an
 * average ("4.6 (12)") and is read-only wherever a score is displayed. Merging
 * selection into it would give one component two contracts and force every
 * display site to opt out of interactivity.
 */
withDefaults(
  defineProps<{
    modelValue: number
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

/** Preview on hover; falls back to the committed value when the pointer leaves. */
const hovered = ref(0)

const labels = ['Juda yomon', 'Yomon', "O'rtacha", 'Yaxshi', "A'lo"]
</script>

<template>
  <div>
    <div class="flex items-center gap-1" role="radiogroup" aria-label="Baho">
      <button
        v-for="star in 5"
        :key="star"
        type="button"
        role="radio"
        :aria-checked="modelValue === star"
        :aria-label="`${star} — ${labels[star - 1]}`"
        :disabled="disabled"
        class="text-2xl transition-transform disabled:cursor-not-allowed hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary-500 rounded"
        :class="(hovered || modelValue) >= star ? 'text-star' : 'text-ink-faint'"
        @click="emit('update:modelValue', star)"
        @mouseenter="hovered = star"
        @mouseleave="hovered = 0"
        @focus="hovered = star"
        @blur="hovered = 0"
      >
        <FontAwesomeIcon :icon="(hovered || modelValue) >= star ? icons.starSolid : icons.starOutline" />
      </button>
    </div>

    <p class="text-xs text-ink-muted mt-1 h-4">
      {{ (hovered || modelValue) ? labels[(hovered || modelValue) - 1] : '' }}
    </p>
  </div>
</template>
