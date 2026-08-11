<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminApi } from '@/api/admin'
import type { AuditLog } from '@/types'

const logs = ref<AuditLog[]>([])
const loading = ref(true)
const hasError = ref(false)

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.auditLogs()
    logs.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Audit jurnali</h1>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead>
          <tr class="border-b border-border text-left text-ink-faint">
            <th class="px-5 py-3 font-medium">Admin</th>
            <th class="px-5 py-3 font-medium">Amal</th>
            <th class="px-5 py-3 font-medium">Obyekt</th>
            <th class="px-5 py-3 font-medium">Tafsilotlar</th>
            <th class="px-5 py-3 font-medium">Vaqt</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-5 py-3" v-for="i in 5" :key="i"><Skeleton variant="text" width="80%" /></td>
          </tr>
          <tr v-else-if="hasError">
            <td colspan="5" class="px-5 py-8"><ErrorState @retry="load" /></td>
          </tr>
          <tr v-else-if="logs.length === 0">
            <td colspan="5" class="px-5 py-8 text-center text-ink-faint">Yozuvlar yo'q.</td>
          </tr>
          <tr v-for="log in logs" :key="log.id" class="border-b border-border last:border-0">
            <td class="px-5 py-3 text-ink-muted">{{ log.admin_name }}</td>
            <td class="px-5 py-3 font-medium text-ink">{{ log.action }}</td>
            <td class="px-5 py-3 text-ink-muted">{{ log.entity_type }} #{{ log.entity_id }}</td>
            <td class="px-5 py-3 text-ink-faint text-xs max-w-xs truncate">{{ JSON.stringify(log.meta) }}</td>
            <td class="px-5 py-3 text-ink-muted whitespace-nowrap">{{ new Date(log.created_at).toLocaleString('uz-UZ') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </AdminLayout>
</template>
