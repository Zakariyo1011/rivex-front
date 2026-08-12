<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import Avatar from '@/components/ui/Avatar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import KycDocumentViewer from '@/components/admin/KycDocumentViewer.vue'
import { adminApi } from '@/api/admin'
import { icons } from '@/lib/icons'
import type { IdentityVerification } from '@/types'
import { formatDateTime } from '@/lib/datetime'
import { kycStatus } from '@/lib/statusLabels'

const verifications = ref<IdentityVerification[]>([])
const loading = ref(true)
const hasError = ref(false)
const statusFilter = ref('pending')
const actingId = ref<number | null>(null)
const rejecting = ref<IdentityVerification | null>(null)
const rejectReason = ref('')
const submitting = ref(false)

/** Statuses an admin still has to decide on. */
const actionable = (status: string) => status === 'pending' || status === 'needs_review'

const formatDate = (value: string | null) => (value ? formatDateTime(value) : "Ma'lum emas")

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.verifications({ status: statusFilter.value || undefined })
    verifications.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
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
      class="h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none mb-5"
      @change="load"
    >
      <option value="">Barchasi</option>
      <option value="pending">Kutilmoqda</option>
      <option value="needs_review">Qo'shimcha tekshiruv</option>
      <option value="verified">Tasdiqlangan</option>
      <option value="rejected">Rad etilgan</option>
    </select>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="card p-5 flex items-center gap-3">
        <Skeleton variant="circle" width="2rem" height="2rem" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <EmptyState
      v-else-if="verifications.length === 0"
      :icon="icons.identity"
      title="Arizalar yo'q"
    />

    <div v-else class="space-y-3">
      <div v-for="verification in verifications" :key="verification.id" class="card p-5">
        <div class="flex items-center justify-between mb-2">
          <RouterLink
            v-if="verification.user"
            :to="{ name: 'user-profile', params: { id: verification.user.id } }"
            class="font-semibold text-ink hover:text-primary-600 flex items-center gap-2.5"
          >
            <Avatar
              :src="verification.user.profile.avatar_url"
              :name="verification.user.name"
              size="sm"
            />
            {{ verification.user.name }}
          </RouterLink>
          <span v-else class="font-semibold text-ink-faint">Foydalanuvchi topilmadi</span>
          <StatusBadge
            :status="verification.status"
            :labels="kycStatus.labels"
            :variants="kycStatus.variants"
          />
        </div>
        <p class="text-xs text-ink-faint mb-3">
          Yuborilgan: {{ formatDate(verification.submitted_at) }} · Urinish:
          {{ verification.attempts }}/{{ verification.max_attempts }}
        </p>

        <KycDocumentViewer
          v-if="verification.documents?.length"
          :documents="verification.documents"
          class="mb-4"
        />
        <p
          v-if="verification.rejection_reason"
          class="text-sm text-danger bg-danger-bg rounded-lg p-3 mb-3"
        >
          Rad etish sababi: {{ verification.rejection_reason }}
        </p>

        <div v-if="actionable(verification.status)" class="flex gap-3">
          <AppButton
            class="!w-auto px-5 !h-9 text-sm"
            :loading="actingId === verification.id"
            @click="approve(verification)"
          >
            Tasdiqlash
          </AppButton>
          <button class="text-sm font-medium text-danger" @click="rejecting = verification">
            Rad etish
          </button>
        </div>
      </div>
    </div>

    <AppModal v-if="rejecting" title="Tasdiqlashni rad etish" @close="rejecting = null">
      <p class="text-sm text-ink-muted mb-3">
        {{ rejecting.user?.name ?? 'Foydalanuvchi' }} uchun rad etish sababi
      </p>
      <AppTextarea v-model="rejectReason" :rows="3" placeholder="Sabab (majburiy)" class="mb-3" />
      <AppButton :disabled="!rejectReason.trim()" :loading="submitting" @click="submitReject"
        >Rad etish</AppButton
      >
    </AppModal>
  </AdminLayout>
</template>
