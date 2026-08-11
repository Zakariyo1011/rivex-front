<script setup lang="ts">
import { computed } from 'vue'
import { icons } from '@/lib/icons'

const props = defineProps<{
  currentPage: number
  lastPage: number
}>()
const emit = defineEmits<{ 'update:currentPage': [value: number] }>()

const pages = computed(() => {
  const total = props.lastPage
  const current = props.currentPage
  const range: (number | '...')[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      range.push(i)
    } else if (range[range.length - 1] !== '...') {
      range.push('...')
    }
  }
  return range
})

function go(page: number) {
  if (page >= 1 && page <= props.lastPage) emit('update:currentPage', page)
}
</script>

<template>
  <div v-if="lastPage > 1" class="flex items-center justify-center gap-1">
    <button
      type="button"
      class="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted disabled:opacity-30"
      :disabled="currentPage === 1"
      @click="go(currentPage - 1)"
    >
      <FontAwesomeIcon :icon="icons.chevronLeft" class="text-xs" />
    </button>
    <template v-for="(p, i) in pages" :key="i">
      <span v-if="p === '...'" class="w-9 h-9 flex items-center justify-center text-ink-faint text-sm">…</span>
      <button
        v-else
        type="button"
        class="w-9 h-9 rounded-lg text-sm font-medium transition"
        :class="p === currentPage ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-surface-muted'"
        @click="go(p as number)"
      >
        {{ p }}
      </button>
    </template>
    <button
      type="button"
      class="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted disabled:opacity-30"
      :disabled="currentPage === lastPage"
      @click="go(currentPage + 1)"
    >
      <FontAwesomeIcon :icon="icons.chevronRight" class="text-xs" />
    </button>
  </div>
</template>
