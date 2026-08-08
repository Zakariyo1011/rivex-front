<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { adminApi } from '@/api/admin'
import type { User } from '@/types'

const users = ref<User[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const actingId = ref<number | null>(null)

const statusClasses: Record<string, string> = {
  active: 'bg-success-bg text-success',
  suspended: 'bg-amber-50 text-amber-600',
  banned: 'bg-danger-bg text-danger',
}

async function load() {
  loading.value = true
  const { data } = await adminApi.users({ q: search.value || undefined, status: statusFilter.value || undefined })
  users.value = data.data
  loading.value = false
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
        class="h-10 flex-1 max-w-sm px-4 rounded-xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary-100"
        @input="onSearchInput"
      />
      <select
        v-model="statusFilter"
        class="h-10 px-3 rounded-xl border border-border bg-white text-sm outline-none"
        @change="load"
      >
        <option value="">Barcha holatlar</option>
        <option value="active">Faol</option>
        <option value="suspended">Muzlatilgan</option>
        <option value="banned">Bloklangan</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full text-sm">
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
            <td colspan="5" class="px-5 py-8 text-center text-ink-faint">Yuklanmoqda...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="5" class="px-5 py-8 text-center text-ink-faint">Foydalanuvchi topilmadi.</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="border-b border-border last:border-0">
            <td class="px-5 py-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold overflow-hidden">
                  <img v-if="user.profile.avatar_url" :src="user.profile.avatar_url" class="w-full h-full object-cover" />
                  <span v-else>{{ user.name[0] }}</span>
                </div>
                <RouterLink :to="{ name: 'user-profile', params: { id: user.id } }" class="font-medium text-ink hover:text-primary-600">
                  {{ user.name }}
                </RouterLink>
              </div>
            </td>
            <td class="px-5 py-3 text-ink-muted">{{ user.phone }}</td>
            <td class="px-5 py-3">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="statusClasses[user.status]">
                {{ user.status }}
              </span>
            </td>
            <td class="px-5 py-3">
              <span v-if="user.identity_verified" class="text-primary-500">✓</span>
              <span v-else class="text-ink-faint">—</span>
            </td>
            <td class="px-5 py-3 text-right space-x-2">
              <button
                v-if="user.status !== 'suspended'"
                class="text-xs font-medium text-amber-600 disabled:opacity-50"
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
  </AdminLayout>
</template>
