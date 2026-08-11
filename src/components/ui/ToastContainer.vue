<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { icons } from '@/lib/icons'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      name="toast"
      class="fixed bottom-4 tablet:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white cursor-pointer"
        :class="{
          'bg-success': t.variant === 'success',
          'bg-danger': t.variant === 'error',
          'bg-ink': t.variant === 'info',
        }"
        @click="dismiss(t.id)"
      >
        <FontAwesomeIcon :icon="t.variant === 'success' ? icons.check : t.variant === 'error' ? icons.error : icons.info" />
        <span class="flex-1">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>
