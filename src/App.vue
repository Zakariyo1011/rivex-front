<script setup lang="ts">
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useThemeStore } from '@/stores/theme'

// Instantiating the store applies the persisted theme immediately on load.
useThemeStore()
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <ToastContainer />
</template>
