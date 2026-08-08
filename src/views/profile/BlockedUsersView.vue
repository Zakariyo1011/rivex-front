<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { safetyApi } from '@/api/safety'
import type { Block } from '@/types'

const blocks = ref<Block[]>([])
const loading = ref(true)
const removingId = ref<number | null>(null)

async function unblock(block: Block) {
  removingId.value = block.id
  try {
    await safetyApi.unblock(block.blocked_user.id)
    blocks.value = blocks.value.filter((b) => b.id !== block.id)
  } finally {
    removingId.value = null
  }
}

onMounted(async () => {
  const { data } = await safetyApi.myBlocks()
  blocks.value = data.data
  loading.value = false
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <h1 class="text-xl font-bold text-ink mb-5">Bloklangan foydalanuvchilar</h1>

      <div v-if="loading" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>
      <div v-else-if="blocks.length === 0" class="text-ink-faint text-sm py-12 text-center">
        Bloklangan foydalanuvchilar yo'q.
      </div>

      <div v-else class="space-y-2">
        <div v-for="block in blocks" :key="block.id" class="card p-4 flex items-center gap-3">
          <div class="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden shrink-0">
            <img v-if="block.blocked_user.profile.avatar_url" :src="block.blocked_user.profile.avatar_url" class="w-full h-full object-cover" />
            <span v-else>{{ block.blocked_user.name[0] }}</span>
          </div>
          <p class="font-medium text-ink flex-1 min-w-0 truncate">{{ block.blocked_user.name }}</p>
          <button
            class="text-sm text-primary-600 font-medium shrink-0 disabled:opacity-50"
            :disabled="removingId === block.id"
            @click="unblock(block)"
          >
            Blokdan chiqarish
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
