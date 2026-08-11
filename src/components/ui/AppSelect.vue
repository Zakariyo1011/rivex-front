<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    modelValue: string | number | null
    label?: string
    options: { value: string | number | null; label: string }[]
    placeholder?: string
    disabled?: boolean
    /** Coerce the emitted value to a number (native <select> only ever gives strings). */
    numeric?: boolean
  }>(),
  { disabled: false, numeric: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

function onChange(event: Event, numeric: boolean) {
  const raw = (event.target as HTMLSelectElement).value
  if (raw === '') {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', numeric ? Number(raw) : raw)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="block text-sm font-medium text-ink-secondary mb-1.5">{{ label }}</span>
    <div class="relative">
      <select
        :value="modelValue ?? ''"
        :disabled="disabled"
        class="w-full h-12 pl-4 pr-10 rounded-xl border border-border bg-surface text-[15px] outline-none transition focus:ring-2 focus:ring-primary-100 focus:border-primary-400 appearance-none disabled:bg-surface-muted disabled:text-ink-faint"
        @change="onChange($event, numeric)"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="opt in options" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
      </select>
      <FontAwesomeIcon
        :icon="icons.chevronDown"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint text-xs pointer-events-none"
      />
    </div>
  </label>
</template>
