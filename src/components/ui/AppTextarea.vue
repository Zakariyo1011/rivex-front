<script setup lang="ts">
import { computed, useAttrs } from 'vue'

/**
 * A labelled multi-line field.
 *
 * Attributes are split the same way `AppInput` splits them and for the same
 * reason: the root element is the `<label>`, so `maxlength` was landing there,
 * where it does nothing. `class` and `style` stay on the wrapper because
 * callers pass them for layout.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    placeholder?: string
    error?: string
    rows?: number
    /** Shows a live count against `maxlength` — only where one is given. */
    maxlength?: string | number
  }>(),
  { rows: 3 },
)

defineEmits<{ 'update:modelValue': [value: string] }>()

const attrs = useAttrs()

const wrapperAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))

const controlAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== 'class' && key !== 'style'),
  ),
)

const limit = computed(() => (props.maxlength === undefined ? null : Number(props.maxlength)))

/** Only worth showing as the limit gets close; a counter at 3/2000 is noise. */
const showCount = computed(
  () => limit.value !== null && props.modelValue.length > limit.value * 0.8,
)
</script>

<template>
  <label class="block" v-bind="wrapperAttrs">
    <span v-if="label" class="block text-sm font-medium text-ink-secondary mb-1.5">{{ label }}</span>
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      class="w-full rounded-xl border bg-surface text-[15px] p-3 outline-none transition focus:ring-2 resize-none"
      :class="
        error
          ? 'border-danger/40 focus:ring-danger/10 focus:border-danger'
          : 'border-border focus:ring-primary-100 focus:border-primary-400'
      "
      v-bind="controlAttrs"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <span class="flex items-start gap-2 mt-1">
      <span v-if="error" class="block text-xs text-danger flex-1">{{ error }}</span>
      <span v-if="showCount" class="block text-xs text-ink-faint ml-auto tabular-nums">
        {{ modelValue.length }}/{{ limit }}
      </span>
    </span>
  </label>
</template>
