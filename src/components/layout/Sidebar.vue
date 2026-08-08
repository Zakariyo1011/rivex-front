<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const items = [
  { name: 'home', label: 'Home', icon: '🏠' },
  { name: 'explore', label: 'Explore', icon: '🔍' },
  { name: 'applications', label: 'Applications', icon: '📄' },
  { name: 'chats', label: 'Chats', icon: '💬' },
  { name: 'wallet', label: 'Wallet', icon: '💳' },
  { name: 'profile', label: 'Profile', icon: '👤' },
]
</script>

<template>
  <aside class="hidden md:flex md:w-64 lg:w-72 flex-col shrink-0 border-r border-gray-100 bg-white h-screen sticky top-0 px-5 py-6">
    <div class="flex items-center gap-2 px-2 mb-8">
      <div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-sm">🤝</div>
      <span class="text-lg font-bold text-gray-900">Rivex</span>
    </div>

    <RouterLink :to="{ name: 'activity-create' }" class="mb-6">
      <button class="w-full h-11 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-700 transition">
        <span class="text-lg leading-none">+</span> Faoliyat yaratish
      </button>
    </RouterLink>

    <nav class="flex-1 space-y-1">
      <RouterLink
        v-for="item in items"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-medium transition"
        :class="
          route.name === item.name
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-50'
        "
      >
        <span class="text-lg">{{ item.icon }}</span>
        {{ item.label }}
      </RouterLink>
    </nav>

    <RouterLink
      :to="{ name: 'profile' }"
      class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition"
    >
      <div class="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm overflow-hidden">
        <img v-if="auth.user?.profile.avatar_url" :src="auth.user.profile.avatar_url" class="w-full h-full object-cover" />
        <span v-else>{{ auth.user?.name?.[0] }}</span>
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900 truncate">{{ auth.user?.name }}</p>
        <p class="text-xs text-gray-400">Profilni ko'rish</p>
      </div>
    </RouterLink>
  </aside>
</template>
