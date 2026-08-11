<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    padding?: 'none' | 'sm' | 'md' | 'lg'
    hover?: boolean
    clickable?: boolean
  }>(),
  { padding: 'md', hover: false, clickable: false },
)
defineEmits<{ click: [] }>()

const paddingClasses: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}
</script>

<template>
  <div
    class="card"
    :class="[paddingClasses[props.padding], hover || clickable ? 'transition hover:shadow-lg' : '', clickable ? 'cursor-pointer' : '']"
    @click="clickable && $emit('click')"
  >
    <slot />
  </div>
</template>
