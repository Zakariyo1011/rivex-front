<script setup lang="ts">
import { computed } from 'vue'
import Avatar from './Avatar.vue'

const props = withDefaults(
  defineProps<{
    users: { name: string; avatar_url?: string | null }[]
    max?: number
    size?: 'xs' | 'sm' | 'md'
  }>(),
  { max: 4, size: 'sm' },
)

const visible = computed(() => props.users.slice(0, props.max))
const extra = computed(() => Math.max(0, props.users.length - props.max))

const extraSizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
}
</script>

<template>
  <div class="flex items-center -space-x-2">
    <div v-for="(u, i) in visible" :key="i" class="ring-2 ring-white rounded-full">
      <Avatar :src="u.avatar_url" :name="u.name" :size="size" />
    </div>
    <div
      v-if="extra > 0"
      class="ring-2 ring-white rounded-full bg-surface-muted text-ink-muted flex items-center justify-center font-semibold shrink-0"
      :class="extraSizeClasses[size]"
    >
      +{{ extra }}
    </div>
  </div>
</template>
