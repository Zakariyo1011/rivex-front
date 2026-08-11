<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import Avatar from '@/components/ui/Avatar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminApi } from '@/api/admin'
import { icons } from '@/lib/icons'
import type { User } from '@/types'

const users = ref<User[]>([])
const loading = ref(true)
const hasError = ref(false)
const search = ref('')
const statusFilter = ref('')
const actingId = ref<number | null>(null)

const statusLabels: Record<string, string> = {
  active: 'Faol',
  suspended: 'Muzlatilgan',
  banned: 'Bloklangan',
}

const statusVariants: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  banned: 'danger',
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.users({ q: search.value || undefined, status: statusFilter.value || undefined })
    users.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function setStatus(user: User, status: 'active' | 'suspended' | 'banned') {
  actingId.value = user.id
  try {
    const { data } = await adminApi.updateUserStatus(user.id, status)
    const index = users.value.findIndex((u) => u.id === user.id)
    if (index !== -1) users.value[index] = data.data
  } finally {
    actingId.value = null
  }
}

let searchTimeout: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(load, 350)
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Foydalanuvchilar</h1>

    <div class="flex gap-3 mb-5">
      <input
        v-model="search"
        type="text"
        placeholder="Ism yoki telefon bo'yicha qidirish..."
        class="h-10 flex-1 max-w-sm px-4 rounded-xl border border-border bg-surface text-sm outline-none focus:ring-2 focus:ring-primary-100"
        @input="onSearchInput"
      />
      <select
        v-model="statusFilter"
        class="h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none"
        @change="load"
      >
        <option value="">Barcha holatlar</option>
        <option value="active">Faol</option>
        <option value="suspended">Muzlatilgan</option>
        <option value="banned">Bloklangan</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead>
          <tr class="border-b border-border text-left text-ink-faint">
            <th class="px-5 py-3 font-medium">Foydalanuvchi</th>
            <th class="px-5 py-3 font-medium">Telefon</th>
            <th class="px-5 py-3 font-medium">Holat</th>
            <th class="px-5 py-3 font-medium">Tasdiqlangan</th>
            <th class="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-5 py-3" v-for="i in 5" :key="i"><Skeleton variant="text" width="80%" /></td>
          </tr>
          <tr v-else-if="hasError">
            <td colspan="5" class="px-5 py-8"><ErrorState @retry="load" /></td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="5" class="px-5 py-8 text-center text-ink-faint">Foydalanuvchi topilmadi.</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="border-b border-border last:border-0">
            <td class="px-5 py-3">
              <div class="flex items-center gap-2.5">
                <Avatar :src="user.profile.avatar_url" :name="user.name" size="sm" />
                <RouterLink :to="{ name: 'user-profile', params: { id: user.id } }" class="font-medium text-ink hover:text-primary-600">
                  {{ user.name }}
                </RouterLink>
              </div>
            </td>
            <td class="px-5 py-3 text-ink-muted">{{ user.phone }}</td>
            <td class="px-5 py-3">
              <StatusBadge :status="user.status" :labels="statusLabels" :variants="statusVariants" />
            </td>
            <td class="px-5 py-3">
              <FontAwesomeIcon v-if="user.identity_verified" :icon="icons.verified" class="text-primary-500" />
              <span v-else class="text-ink-faint">—</span>
            </td>
            <td class="px-5 py-3 text-right space-x-2">
              <button
                v-if="user.status !== 'suspended'"
                class="text-xs font-medium text-warning disabled:opacity-50"
                :disabled="actingId === user.id"
                @click="setStatus(user, 'suspended')"
              >
                Muzlatish
              </button>
              <button
                v-if="user.status !== 'banned'"
                class="text-xs font-medium text-danger disabled:opacity-50"
                :disabled="actingId === user.id"
                @click="setStatus(user, 'banned')"
              >
                Bloklash
              </button>
              <button
                v-if="user.status !== 'active'"
                class="text-xs font-medium text-success disabled:opacity-50"
                :disabled="actingId === user.id"
                @click="setStatus(user, 'active')"
              >
                Faollashtirish
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </AdminLayout>
</template>
