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

/**
 * Which provider reached the decision, in words.
 *
 * `dev_auto` is spelled out rather than prettified: a reviewer must be able to
 * tell a local test approval from a real one at a glance, and a friendly label
 * would hide exactly the distinction that matters.
 */
const providerLabel = (provider: string) =>
  ({
    dev_auto: 'Test tasdiqlash (avtomatik, tekshirilmagan)',
    manual: 'Admin (qo\'lda)',
    myid: 'MyID',
  })[provider] ?? provider

const isTestProvider = (verification: IdentityVerification) => verification.provider === 'dev_auto'

/** The reading, as labelled rows, skipping fields the scan did not yield. */
function extractedRows(verification: IdentityVerification) {
  const data = verification.extracted_document

  if (!data) return []

  return [
    { label: 'Ism', value: data.first_name },
    { label: 'Familiya', value: data.last_name },
    { label: 'Hujjat raqami', value: data.document_number },
    { label: "Tug'ilgan sana", value: data.date_of_birth },
    { label: 'Amal qilish muddati', value: data.expires_on },
  ].filter((row): row is { label: string; value: string } => !!row.value)
}

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
        <!-- The facts a reviewer needs before opening anything: who, what kind
             of document, when it arrived, and which provider decided. -->
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs mb-4">
          <div>
            <dt class="text-ink-faint">Hujjat turi</dt>
            <dd class="text-ink-secondary font-medium">
              {{ verification.document_type_label ?? "Ko'rsatilmagan" }}
            </dd>
          </div>
          <div>
            <dt class="text-ink-faint">Yuborilgan</dt>
            <dd class="text-ink-secondary font-medium">
              {{ formatDate(verification.submitted_at) }}
            </dd>
          </div>
          <div>
            <dt class="text-ink-faint">Ko'rib chiqilgan</dt>
            <dd class="text-ink-secondary font-medium">
              {{ formatDate(verification.reviewed_at) }}
            </dd>
          </div>
          <div>
            <dt class="text-ink-faint">Urinish</dt>
            <dd class="text-ink-secondary font-medium">
              {{ verification.attempts }}/{{ verification.max_attempts }}
            </dd>
          </div>
          <div v-if="verification.user?.email" class="col-span-2">
            <dt class="text-ink-faint">Email</dt>
            <dd class="text-ink-secondary font-medium truncate">{{ verification.user.email }}</dd>
          </div>
          <div v-if="verification.user?.phone" class="col-span-2">
            <dt class="text-ink-faint">Telefon</dt>
            <dd class="text-ink-secondary font-medium">{{ verification.user.phone }}</dd>
          </div>
          <div v-if="verification.provider" class="col-span-2 sm:col-span-4">
            <dt class="text-ink-faint">Qaror kim tomonidan</dt>
            <dd class="font-medium" :class="isTestProvider(verification) ? 'text-warning' : 'text-ink-secondary'">
              {{ providerLabel(verification.provider) }}
            </dd>
          </div>
        </dl>

        <!-- A test approval must never be mistaken for a real one. This is the
             whole reason DevAutoKycProvider reports its own name rather than
             borrowing a provider's. -->
        <p
          v-if="isTestProvider(verification)"
          class="mb-4 rounded-lg bg-warning-bg border border-warning/30 px-3 py-2 text-xs text-ink-secondary flex items-start gap-2"
        >
          <FontAwesomeIcon :icon="icons.testMode" class="text-warning mt-0.5 shrink-0" />
          <span>
            Bu tasdiqlash <strong>test rejimida</strong> avtomatik berilgan. Hujjat haqiqiyligi
            va yuz mosligi tekshirilmagan.
          </span>
        </p>

        <KycDocumentViewer
          v-if="verification.documents?.length"
          :documents="verification.documents"
          class="mb-4"
        />

        <!-- What OCR read off the document.
             Offered to the reviewer as a hint and labelled as one: it says
             "suggests", never "verified". A forged document with clean text
             OCRs perfectly, so this shortens a review and never replaces it.
             See App\Kyc\Ocr\DocumentReaderInterface. -->
        <details
          v-if="verification.extracted_document?.succeeded"
          class="mb-4 rounded-xl border border-border bg-surface-muted/60"
        >
          <summary class="px-3 py-2 text-xs font-medium text-ink-muted cursor-pointer select-none">
            Hujjatdan o'qilgan ma'lumot
            <span class="text-ink-faint font-normal">
              · {{ verification.document_reader }} · faqat ishora
            </span>
          </summary>

          <dl class="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div v-for="row in extractedRows(verification)" :key="row.label">
              <dt class="text-ink-faint">{{ row.label }}</dt>
              <dd class="text-ink-secondary font-medium break-all">{{ row.value }}</dd>
            </div>
          </dl>
        </details>
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
