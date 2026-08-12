<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Pagination from '@/components/ui/Pagination.vue'
import Avatar from '@/components/ui/Avatar.vue'
import { adminApi } from '@/api/admin'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { disputeStatus, noShowStatus } from '@/lib/statusLabels'
import { icons } from '@/lib/icons'
import { formatDateTime, formatActivityStart } from '@/lib/datetime'
import type { Dispute, DisputeResolution } from '@/types'

/**
 * Admin adjudication of no-show disputes.
 *
 * The panel presents the case and records a decision — it never re-derives what
 * a decision means. Whether the accused is penalised and whether money moves
 * are properties of the `DisputeResolution` enum on the server; this screen
 * only explains them so the admin knows which lever they are pulling.
 */
const toast = useToast()

const disputes = ref<Dispute[]>([])
const loading = ref(true)
const hasError = ref(false)
const page = ref(1)
const lastPage = ref(1)
const search = ref('')
const status = ref('')

const selected = ref<Dispute | null>(null)
const detailLoading = ref(false)
const resolution = ref<DisputeResolution | ''>('')
const note = ref('')
const resolving = ref(false)
const error = ref('')

const statusOptions = [
  { value: '', label: 'Barcha holatlar' },
  { value: 'open', label: 'Ochiq' },
  { value: 'under_review', label: "Ko'rib chiqilmoqda" },
  { value: 'resolved', label: 'Hal qilingan' },
]

/**
 * Mirrors `App\Enums\DisputeResolution`. The descriptions restate what the
 * backend does — they do not decide it.
 */
const resolutions: { value: DisputeResolution; label: string; effect: string }[] = [
  {
    value: 'confirmed_no_show',
    label: 'Kelmagani tasdiqlandi',
    effect: 'Ayblanuvchi jazolanadi (ishonch balli tushadi). Pul harakat qilmaydi.',
  },
  {
    value: 'no_violation',
    label: "Qoidabuzarlik yo'q",
    effect: 'Ayblanuvchi oqlanadi. Pul harakat qilmaydi.',
  },
  {
    value: 'partial_fault',
    label: 'Ikkala tomon aybdor',
    effect: 'Qayd etiladi, lekin hech kim jazolanmaydi. Pul harakat qilmaydi.',
  },
  {
    value: 'cancelled',
    label: 'Bekor qilingan deb hisoblandi',
    effect: 'Jazo yo\'q. Komissiya to\'lovchiga qaytariladi.',
  },
  {
    value: 'refund',
    label: "Mablag' qaytarildi",
    effect: 'Jazo yo\'q. Komissiya to\'lovchiga qaytariladi.',
  },
  {
    value: 'no_refund',
    label: "Mablag' qaytarilmaydi",
    effect: 'Jazo yo\'q. Pul harakat qilmaydi.',
  },
]

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.disputes({
      page: page.value,
      status: status.value || undefined,
      q: search.value || undefined,
    })
    disputes.value = data.data
    lastPage.value = data.meta.last_page
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

/**
 * Opening the detail also marks the case under review server-side, so the
 * fresh copy is used rather than the list row.
 */
async function openDetail(dispute: Dispute) {
  selected.value = dispute
  resolution.value = ''
  note.value = ''
  error.value = ''
  detailLoading.value = true

  try {
    const { data } = await adminApi.dispute(dispute.id)
    selected.value = data.data
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    detailLoading.value = false
  }
}

async function resolve() {
  if (!selected.value || !resolution.value) return

  error.value = ''
  resolving.value = true

  try {
    await adminApi.resolveDispute(selected.value.id, resolution.value, note.value || undefined)
    toast.success('Nizo hal qilindi.')
    selected.value = null
    await load()
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    resolving.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})

watch([page, status], load)

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="p-5 md:p-8">
      <h1 class="text-xl md:text-2xl font-bold text-ink mb-5">Nizolar</h1>

      <div class="flex flex-col md:flex-row gap-3 mb-5">
        <AppSearchInput
          v-model="search"
          placeholder="Faoliyat yoki foydalanuvchi nomi..."
          class="flex-1"
        />
        <AppSelect v-model="status" :options="statusOptions" class="md:w-56" />
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="text" width="65%" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <EmptyState
        v-else-if="disputes.length === 0"
        :icon="icons.trust"
        title="Nizolar yo'q"
        description="Hal qilinishi kerak bo'lgan nizo topilmadi."
      />

      <div v-else class="space-y-3">
        <button
          v-for="dispute in disputes"
          :key="dispute.id"
          class="w-full text-left card card-hover p-4"
          @click="openDetail(dispute)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-ink">
                {{ dispute.activity?.title ?? `Faoliyat #${dispute.activity_id}` }}
              </p>
              <p class="text-sm text-ink-muted line-clamp-1">{{ dispute.reason }}</p>
            </div>
            <StatusBadge
              :status="dispute.status"
              :labels="disputeStatus.labels"
              :variants="disputeStatus.variants"
              class="shrink-0"
            />
          </div>

          <div class="flex items-center gap-4 mt-3 text-xs text-ink-faint">
            <span>#{{ dispute.id }}</span>
            <span>{{ formatDateTime(dispute.created_at) }}</span>
            <span v-if="dispute.resolution_label" class="text-ink-muted font-medium">
              {{ dispute.resolution_label }}
            </span>
          </div>
        </button>

        <Pagination v-model:current-page="page" :last-page="lastPage" />
      </div>
    </div>

    <AppModal v-if="selected" :title="`Nizo #${selected.id}`" @close="selected = null">
      <div v-if="detailLoading" class="space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
      </div>

      <div v-else class="space-y-4">
        <!-- Activity -->
        <section>
          <p class="text-xs font-semibold text-ink-faint uppercase mb-1">Faoliyat</p>
          <p class="font-medium text-ink">{{ selected.activity?.title }}</p>
          <p v-if="selected.activity" class="text-sm text-ink-muted">
            {{ formatActivityStart(selected.activity.start_at) }}
          </p>
        </section>

        <!-- The two sides -->
        <section v-if="selected.no_show_report" class="space-y-2">
          <p class="text-xs font-semibold text-ink-faint uppercase">Tomonlar</p>

          <div
            v-if="selected.no_show_report.reporter"
            class="flex items-center gap-2 rounded-xl bg-surface-muted p-2.5"
          >
            <Avatar
              :src="selected.no_show_report.reporter.profile?.avatar_url"
              :name="selected.no_show_report.reporter.name"
              size="sm"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">
                {{ selected.no_show_report.reporter.name }}
              </p>
              <p class="text-xs text-ink-muted">Shikoyat qilgan</p>
            </div>
          </div>

          <div
            v-if="selected.no_show_report.accused"
            class="flex items-center gap-2 rounded-xl bg-surface-muted p-2.5"
          >
            <Avatar
              :src="selected.no_show_report.accused.profile?.avatar_url"
              :name="selected.no_show_report.accused.name"
              size="sm"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">
                {{ selected.no_show_report.accused.name }}
              </p>
              <p class="text-xs text-ink-muted">Ayblanuvchi</p>
            </div>
          </div>
        </section>

        <!-- Evidence: the report, and the answer to it -->
        <section v-if="selected.no_show_report" class="space-y-2">
          <p class="text-xs font-semibold text-ink-faint uppercase">Shikoyat</p>
          <StatusBadge
            :status="selected.no_show_report.status"
            :labels="noShowStatus.labels"
            :variants="noShowStatus.variants"
          />
          <p v-if="selected.no_show_report.reporter_note" class="text-sm text-ink">
            "{{ selected.no_show_report.reporter_note }}"
          </p>
          <p v-else class="text-sm text-ink-faint">Izoh qoldirilmagan.</p>
        </section>

        <section>
          <p class="text-xs font-semibold text-ink-faint uppercase mb-1">Ayblanuvchi javobi</p>
          <p class="text-sm text-ink">{{ selected.reason }}</p>
        </section>

        <!-- Decision, or the record of one -->
        <section v-if="selected.status === 'resolved'" class="rounded-xl bg-success-bg p-3">
          <p class="text-sm font-semibold text-success">{{ selected.resolution_label }}</p>
          <p v-if="selected.resolution_note" class="text-sm text-ink-muted mt-1">
            {{ selected.resolution_note }}
          </p>
          <p v-if="selected.resolved_at" class="text-xs text-ink-faint mt-1">
            {{ formatDateTime(selected.resolved_at) }}
          </p>
        </section>

        <section v-else class="space-y-3">
          <p class="text-xs font-semibold text-ink-faint uppercase">Qaror</p>

          <button
            v-for="option in resolutions"
            :key="option.value"
            class="w-full text-left rounded-xl border p-3 transition"
            :class="resolution === option.value ? 'border-primary-500 bg-primary-50/50' : 'border-border'"
            @click="resolution = option.value"
          >
            <p class="text-sm font-semibold text-ink">{{ option.label }}</p>
            <p class="text-xs text-ink-muted mt-0.5">{{ option.effect }}</p>
          </button>

          <AppTextarea
            v-model="note"
            label="Ichki izoh (audit logga yoziladi)"
            placeholder="Qaror sababini yozing"
            :rows="3"
          />

          <p v-if="error" class="text-sm text-danger">{{ error }}</p>

          <div class="flex gap-2">
            <AppButton variant="ghost" class="flex-1" @click="selected = null">Yopish</AppButton>
            <AppButton
              class="flex-1"
              :disabled="!resolution"
              :loading="resolving"
              @click="resolve"
            >
              Qaror qabul qilish
            </AppButton>
          </div>
        </section>
      </div>
    </AppModal>
  </AdminLayout>
</template>
