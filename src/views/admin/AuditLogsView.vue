<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppInput from '@/components/ui/AppInput.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { adminApi } from '@/api/admin'
import { formatDateTime } from '@/lib/datetime'
import type { AuditLog, AuditLogFilters } from '@/types'

/**
 * The record of what every admin did. Super admin only.
 *
 * Filters are the point: an unfilterable list of thousands of rows answers no
 * question. The choices come from the server, derived from the rows that exist,
 * so the dropdowns never offer an action nobody has ever performed.
 */
const logs = ref<AuditLog[]>([])
const filters = ref<AuditLogFilters>({ actions: [], entity_types: [], admins: [] })
const loading = ref(true)
const hasError = ref(false)
const page = ref(1)
const lastPage = ref(1)

const search = ref('')
const adminId = ref<string>('')
const action = ref('')
const entityType = ref('')
const from = ref('')
const to = ref('')

const adminOptions = computed(() => [
  { value: '', label: 'Barcha adminlar' },
  ...filters.value.admins.map((a) => ({ value: String(a.id), label: a.name })),
])

const actionOptions = computed(() => [
  { value: '', label: 'Barcha amallar' },
  ...filters.value.actions.map((a) => ({ value: a, label: a })),
])

const entityOptions = computed(() => [
  { value: '', label: 'Barcha obyektlar' },
  ...filters.value.entity_types.map((t) => ({ value: t, label: t })),
])

const hasActiveFilter = computed(
  () => !!(search.value || adminId.value || action.value || entityType.value || from.value || to.value),
)

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const { data } = await adminApi.auditLogs({
      page: page.value,
      q: search.value || undefined,
      admin_id: adminId.value ? Number(adminId.value) : undefined,
      action: action.value || undefined,
      entity_type: entityType.value || undefined,
      from: from.value || undefined,
      to: to.value || undefined,
    })

    logs.value = data.data
    filters.value = data.meta
    lastPage.value = data.meta.last_page
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function reset() {
  search.value = ''
  adminId.value = ''
  action.value = ''
  entityType.value = ''
  from.value = ''
  to.value = ''
  page.value = 1
  void load()
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})

watch([adminId, action, entityType, from, to], () => {
  page.value = 1
  void load()
})

watch(page, load)

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="p-5 md:p-8">
      <div class="flex items-center justify-between gap-3 mb-1">
        <h1 class="text-xl md:text-2xl font-bold text-ink">Audit jurnali</h1>
        <button
          v-if="hasActiveFilter"
          class="text-sm text-primary-600 font-medium hover:underline shrink-0"
          @click="reset"
        >
          Filtrlarni tozalash
        </button>
      </div>
      <p class="text-sm text-ink-muted mb-5">
        Har bir admin amali shu yerda qayd etiladi. Yozuvlar o'chirilmaydi.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 desktop:grid-cols-3 gap-3 mb-5">
        <AppSearchInput v-model="search" placeholder="Amal, obyekt yoki admin..." />
        <AppSelect v-model="adminId" :options="adminOptions" />
        <AppSelect v-model="action" :options="actionOptions" />
        <AppSelect v-model="entityType" :options="entityOptions" />
        <AppInput v-model="from" type="date" label="Dan" />
        <AppInput v-model="to" type="date" label="Gacha" />
      </div>

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
                <td v-for="i in 5" :key="i" class="px-5 py-3">
                  <Skeleton variant="text" width="80%" />
                </td>
              </tr>
              <tr v-else-if="hasError">
                <td colspan="5" class="px-5 py-8"><ErrorState @retry="load" /></td>
              </tr>
              <tr v-else-if="logs.length === 0">
                <td colspan="5" class="px-5 py-8 text-center text-ink-faint">
                  {{ hasActiveFilter ? 'Bu filtrlarga mos yozuv yo\'q.' : "Yozuvlar yo'q." }}
                </td>
              </tr>
              <tr v-for="log in logs" :key="log.id" class="border-b border-border last:border-0">
                <td class="px-5 py-3 text-ink-muted">{{ log.admin_name }}</td>
                <td class="px-5 py-3 font-medium text-ink whitespace-nowrap">{{ log.action }}</td>
                <td class="px-5 py-3 text-ink-muted whitespace-nowrap">
                  <template v-if="log.entity_type">
                    {{ log.entity_type }}<span v-if="log.entity_id"> #{{ log.entity_id }}</span>
                  </template>
                  <span v-else>—</span>
                </td>
                <td class="px-5 py-3 text-ink-faint text-xs max-w-xs truncate">
                  {{ log.meta && Object.keys(log.meta).length ? JSON.stringify(log.meta) : '—' }}
                </td>
                <td class="px-5 py-3 text-ink-muted whitespace-nowrap">
                  {{ formatDateTime(log.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Pagination v-model:current-page="page" :last-page="lastPage" class="mt-4" />
    </div>
  </AdminLayout>
</template>
