<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import Avatar from '@/components/ui/Avatar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { safetyApi } from '@/api/safety'
import { icons } from '@/lib/icons'
import type { Block } from '@/types'

const blocks = ref<Block[]>([])
const loading = ref(true)
const hasError = ref(false)
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

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await safetyApi.myBlocks()
    blocks.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <h1 class="text-xl font-bold text-ink mb-5">Bloklangan foydalanuvchilar</h1>

      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="card p-4 flex items-center gap-3">
          <Skeleton variant="circle" width="2.75rem" height="2.75rem" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <EmptyState
        v-else-if="blocks.length === 0"
        :icon="icons.block"
        title="Bloklangan foydalanuvchilar yo'q"
      />

      <div v-else class="space-y-2">
        <div v-for="block in blocks" :key="block.id" class="card p-4 flex items-center gap-3">
          <Avatar :src="block.blocked_user.profile.avatar_url" :name="block.blocked_user.name" size="lg" />
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
