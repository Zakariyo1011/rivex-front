<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  { title: "Nimadir xato ketdi" },
)
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-12 px-6">
    <div class="w-14 h-14 rounded-2xl bg-danger-bg text-danger flex items-center justify-center text-xl mb-4">
      <FontAwesomeIcon :icon="icons.error" />
    </div>
    <p class="font-semibold text-ink">{{ title }}</p>
    <p v-if="description" class="text-sm text-ink-muted mt-1 max-w-xs">{{ description }}</p>
    <button
      type="button"
      class="mt-4 h-10 px-5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
      @click="$emit('retry')"
    >
      Qayta urinish
    </button>
  </div>
</template>
