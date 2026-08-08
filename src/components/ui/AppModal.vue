<script setup lang="ts">
defineProps<{ title?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="$emit('close')" />
      <div class="relative w-full md:w-[420px] bg-white rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-ink">{{ title }}</h3>
          <button class="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-ink-muted" @click="$emit('close')">
            ✕
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
