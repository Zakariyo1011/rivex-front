<script setup lang="ts">
import { onMounted, watch } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const auth = useAuthStore()
const notifications = useNotificationsStore()

function initNotifications() {
  if (auth.user) notifications.subscribe(auth.user.id)
}

onMounted(initNotifications)
watch(() => auth.user?.id, initNotifications)
</script>

<template>
  <div class="min-h-screen bg-surface-muted md:flex">
    <Sidebar />

    <div class="fixed top-4 right-4 md:top-6 md:right-8 z-30">
      <NotificationBell />
    </div>

    <div class="flex-1 min-w-0">
      <main class="pb-20 md:pb-8 max-w-5xl mx-auto">
        <slot />
      </main>
    </div>

    <BottomNav />
  </div>
</template>
