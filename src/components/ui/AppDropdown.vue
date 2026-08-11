<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'right' })

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))

defineExpose({ close })
</script>

<template>
  <div ref="root" class="relative inline-block">
    <span @click="toggle">
      <slot name="trigger" />
    </span>
    <Transition name="dropdown">
      <div
        v-if="open"
        class="absolute mt-2 min-w-[180px] bg-surface rounded-xl shadow-lg border border-border z-50 overflow-hidden"
        :class="align === 'right' ? 'right-0' : 'left-0'"
        @click="close"
      >
        <slot name="menu" />
      </div>
    </Transition>
  </div>
</template>
