<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const items = [
  { name: 'home', label: 'Home', icon: '🏠' },
  { name: 'explore', label: 'Explore', icon: '🔍' },
  { name: 'activity-create', label: '', icon: '+' },
  { name: 'chats', label: 'Chats', icon: '💬' },
  { name: 'profile', label: 'Profile', icon: '👤' },
]
</script>

<template>
  <nav
    class="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex items-center justify-around h-[64px] px-2 z-40"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <RouterLink
      v-for="item in items"
      :key="item.name"
      :to="{ name: item.name }"
      class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
    >
      <span
        v-if="item.name === 'activity-create'"
        class="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl -mt-6 shadow-lg shadow-primary-600/30"
      >
        {{ item.icon }}
      </span>
      <template v-else>
        <span
          class="text-xl"
          :class="route.name === item.name ? 'grayscale-0' : 'grayscale opacity-50'"
          >{{ item.icon }}</span
        >
        <span
          class="text-[11px] font-medium"
          :class="route.name === item.name ? 'text-primary-600' : 'text-gray-400'"
          >{{ item.label }}</span
        >
      </template>
    </RouterLink>
  </nav>
</template>
