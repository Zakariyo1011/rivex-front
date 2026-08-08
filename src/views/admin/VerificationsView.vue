<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { adminApi } from '@/api/admin'
import type { IdentityVerification } from '@/types'

const verifications = ref<IdentityVerification[]>([])
const loading = ref(true)
const statusFilter = ref('pending')
const actingId = ref<number | null>(null)
const rejecting = ref<IdentityVerification | null>(null)
const rejectReason = ref('')
const submitting = ref(false)

const statusClasses: Record<string, string> = {
  not_verified: 'bg-surface-muted text-ink-muted',
  pending: 'bg-primary-50 text-primary-700',
  verified: 'bg-success-bg text-success',
  rejected: 'bg-danger-bg text-danger',
}

async function load() {
  loading.value = true
  const { data } = await adminApi.verifications({ status: statusFilter.value || undefined })
  verifications.value = data.data
  loading.value = false
}

async function approve(verification: IdentityVerification) {
  actingId.value = verification.id
  try {
    const { data } = await adminApi.approveVerification(verification.id)
    const index = verifications.value.findIndex((v) => v.id === verification.id)
    if (index !== -1) verifications.value[index] = data.data
  } finally {
    actingId.value = null
  }
}

async function submitReject() {
  if (!rejecting.value) return
  submitting.value = true
  try {
    const { data } = await adminApi.rejectVerification(rejecting.value.id, rejectReason.value)
    const index = verifications.value.findIndex((v) => v.id === rejecting.value?.id)
    if (index !== -1) verifications.value[index] = data.data
    rejecting.value = null
    rejectReason.value = ''
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Shaxsni tasdiqlash</h1>

    <select
      v-model="statusFilter"
      class="h-10 px-3 rounded-xl border border-border bg-white text-sm outline-none mb-5"
      @change="load"
    >
      <option value="">Barchasi</option>
      <option value="pending">Kutilmoqda</option>
      <option value="verified">Tasdiqlangan</option>
      <option value="rejected">Rad etilgan</option>
    </select>

    <div v-if="loading" class="text-ink-faint text-sm">Yuklanmoqda...</div>
    <div v-else-if="verifications.length === 0" class="text-ink-faint text-sm">Arizalar yo'q.</div>

    <div v-else class="space-y-3">
      <div v-for="verification in verifications" :key="verification.id" class="card p-5">
        <div class="flex items-center justify-between mb-2">
          <RouterLink :to="{ name: 'user-profile', params: { id: verification.user.id } }" class="font-semibold text-ink hover:text-primary-600 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold overflow-hidden">
              <img v-if="verification.user.profile.avatar_url" :src="verification.user.profile.avatar_url" class="w-full h-full object-cover" />
              <span v-else>{{ verification.user.name[0] }}</span>
            </div>
            {{ verification.user.name }}
          </RouterLink>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="statusClasses[verification.status]">
            {{ verification.status }}
          </span>
        </div>
        <p class="text-xs text-ink-faint mb-3">Yuborilgan: {{ new Date(verification.submitted_at).toLocaleString('uz-UZ') }}</p>
        <p v-if="verification.rejection_reason" class="text-sm text-danger bg-danger-bg rounded-lg p-3 mb-3">
          Rad etish sababi: {{ verification.rejection_reason }}
        </p>

        <div v-if="verification.status === 'pending'" class="flex gap-3">
          <AppButton class="!w-auto px-5 !h-9 text-sm" :loading="actingId === verification.id" @click="approve(verification)">
            Tasdiqlash
          </AppButton>
          <button class="text-sm font-medium text-danger" @click="rejecting = verification">Rad etish</button>
        </div>
      </div>
    </div>

    <AppModal v-if="rejecting" title="Tasdiqlashni rad etish" @close="rejecting = null">
      <p class="text-sm text-ink-muted mb-3">{{ rejecting.user.name }} uchun rad etish sababi</p>
      <textarea
        v-model="rejectReason"
        rows="3"
        placeholder="Sabab (majburiy)"
        class="w-full rounded-xl border border-border p-3 text-[15px] outline-none focus:ring-2 focus:ring-primary-100 mb-3"
      />
      <AppButton :disabled="!rejectReason.trim()" :loading="submitting" @click="submitReject">Rad etish</AppButton>
    </AppModal>
  </AdminLayout>
</template>
