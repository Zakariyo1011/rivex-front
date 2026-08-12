<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminApi } from '@/api/admin'
import { categoryIcon } from '@/lib/icons'
import type { Activity } from '@/types'
import { formatDate } from '@/lib/datetime'
import { activityStatus } from '@/lib/statusLabels'

const activities = ref<Activity[]>([])
const loading = ref(true)
const hasError = ref(false)
const statusFilter = ref('')
const moderating = ref<Activity | null>(null)
const reason = ref('')
const submitting = ref(false)

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.activities({ status: statusFilter.value || undefined })
    activities.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function submitModerate() {
  if (!moderating.value) return
  submitting.value = true
  try {
    const { data } = await adminApi.moderateActivity(moderating.value.id, reason.value || undefined)
    const index = activities.value.findIndex((a) => a.id === moderating.value?.id)
    if (index !== -1) activities.value[index] = data.data
    moderating.value = null
    reason.value = ''
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Faoliyatlar</h1>

    <select
      v-model="statusFilter"
      class="h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none mb-5"
      @change="load"
    >
      <option value="">Barcha holatlar</option>
      <option value="published">Published</option>
      <option value="full">Full</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[640px]">
          <thead>
            <tr class="border-b border-border text-left text-ink-faint">
              <th class="px-5 py-3 font-medium">Faoliyat</th>
              <th class="px-5 py-3 font-medium">Egasi</th>
              <th class="px-5 py-3 font-medium">Sana</th>
              <th class="px-5 py-3 font-medium">Holat</th>
              <th class="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="px-5 py-3" v-for="i in 5" :key="i">
                <Skeleton variant="text" width="80%" />
              </td>
            </tr>
            <tr v-else-if="hasError">
              <td colspan="5" class="px-5 py-8"><ErrorState @retry="load" /></td>
            </tr>
            <tr v-else-if="activities.length === 0">
              <td colspan="5" class="px-5 py-8 text-center text-ink-faint">Faoliyat topilmadi.</td>
            </tr>
            <tr
              v-for="activity in activities"
              :key="activity.id"
              class="border-b border-border last:border-0"
            >
              <td class="px-5 py-3">
                <RouterLink
                  :to="{ name: 'activity-detail', params: { id: activity.id } }"
                  class="font-medium text-ink hover:text-primary-600 flex items-center gap-2"
                >
                  <FontAwesomeIcon
                    :icon="categoryIcon(activity.category.slug)"
                    class="text-primary-500 text-xs"
                  />
                  {{ activity.title }}
                </RouterLink>
              </td>
              <td class="px-5 py-3 text-ink-muted">{{ activity.owner.name }}</td>
              <td class="px-5 py-3 text-ink-muted">{{ formatDate(activity.start_at) }}</td>
              <td class="px-5 py-3">
                <StatusBadge
                  :status="activity.status"
                  :labels="activityStatus.labels"
                  :variants="activityStatus.variants"
                />
              </td>
              <td class="px-5 py-3 text-right">
                <button
                  v-if="!['cancelled', 'completed'].includes(activity.status)"
                  class="text-xs font-medium text-danger"
                  @click="moderating = activity"
                >
                  Bekor qilish
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal v-if="moderating" title="Faoliyatni bekor qilish" @close="moderating = null">
      <p class="text-sm text-ink-muted mb-3">
        "{{ moderating.title }}" faoliyatini bekor qilish sababi
      </p>
      <AppTextarea v-model="reason" :rows="3" placeholder="Sabab (ixtiyoriy)" class="mb-3" />
      <AppButton :loading="submitting" @click="submitModerate">Bekor qilish</AppButton>
    </AppModal>
  </AdminLayout>
</template>
