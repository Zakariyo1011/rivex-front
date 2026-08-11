<script setup lang="ts">
withDefaults(
  defineProps<{
    src?: string | null
    name: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}
</script>

<template>
  <div
    class="rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden shrink-0"
    :class="sizeClasses[size]"
  >
    <img v-if="src" :src="src" class="w-full h-full object-cover" :alt="name" />
    <span v-else>{{ name?.[0]?.toUpperCase() }}</span>
  </div>
</template>
