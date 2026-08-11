<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(defineProps<{ title?: string; side?: 'left' | 'right' }>(), { side: 'right' })
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end tablet:items-stretch"
      :class="side === 'right' ? 'tablet:justify-end' : 'tablet:justify-start'"
    >
      <Transition name="overlay" appear>
        <div class="absolute inset-0 bg-black/40" @click="$emit('close')" />
      </Transition>
      <Transition name="drawer-panel" appear>
        <div
          class="relative w-full tablet:w-[380px] bg-surface rounded-t-3xl tablet:rounded-none tablet:h-full max-h-[85vh] tablet:max-h-none overflow-y-auto shadow-lg"
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
            <h3 class="text-lg font-bold text-ink">{{ title }}</h3>
            <button
              class="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-ink-muted"
              @click="$emit('close')"
            >
              <FontAwesomeIcon :icon="icons.close" class="text-xs" />
            </button>
          </div>
          <div class="p-6">
            <slot />
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
