<script setup lang="ts">
import { icons } from '@/lib/icons'

defineProps<{ title?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end tablet:items-center justify-center">
      <Transition name="overlay" appear>
        <div class="absolute inset-0 bg-black/40" @click="$emit('close')" />
      </Transition>
      <Transition name="modal-panel" appear>
        <div class="relative w-full tablet:w-[420px] bg-surface rounded-t-3xl tablet:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-ink">{{ title }}</h3>
            <button
              class="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-ink-muted"
              @click="$emit('close')"
            >
              <FontAwesomeIcon :icon="icons.close" class="text-xs" />
            </button>
          </div>
          <slot />
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
