<script setup lang="ts">
import { computed, useAttrs } from 'vue'

/**
 * A labelled text field.
 *
 * ## Why attributes are split rather than inherited
 *
 * The root element is the `<label>`, so with Vue's default inheritance every
 * attribute a caller passed landed there instead of on the input. `maxlength`,
 * `min`, `max` and `inputmode` were all being set on a `<label>`, where they
 * mean nothing — the edit form has been asking for a numeric keypad and a
 * 150-character cap since it was written and getting neither.
 *
 * `class` and `style` still belong to the wrapper, because callers pass them
 * for layout (`class="mt-3"`); everything else belongs to the control.
 */
defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue: string | number
  label?: string
  type?: string
  placeholder?: string
  error?: string
  /** Shown under the field when there is no error — what to type, not what went wrong. */
  hint?: string
  autocomplete?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()

const wrapperAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))

const controlAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== 'class' && key !== 'style'),
  ),
)
</script>

<template>
  <label class="block" v-bind="wrapperAttrs">
    <span v-if="label" class="block text-sm font-medium text-ink-secondary mb-1.5">{{ label }}</span>
    <input
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined"
      class="w-full h-12 px-4 rounded-xl border bg-surface text-[15px] outline-none transition focus:ring-2"
      :class="
        error
          ? 'border-danger/40 focus:ring-danger/10 focus:border-danger'
          : 'border-border focus:ring-primary-100 focus:border-primary-400'
      "
      v-bind="controlAttrs"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="block text-xs text-danger mt-1">{{ error }}</span>
    <span v-else-if="hint" class="block text-xs text-ink-faint mt-1">{{ hint }}</span>
  </label>
</template>
