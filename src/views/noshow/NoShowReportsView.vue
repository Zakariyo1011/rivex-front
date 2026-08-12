<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Avatar from '@/components/ui/Avatar.vue'
import { noShowApi } from '@/api/noshow'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel } from '@/composables/useEchoChannel'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { noShowStatus } from '@/lib/statusLabels'
import { icons } from '@/lib/icons'
import { formatActivityStart, formatDateTime } from '@/lib/datetime'
import type { NoShowReport } from '@/types'

/**
 * "Complaints against me."
 *
 * The backend has run this state machine since Phase 4 with no screen behind
 * it, which meant the 48-hour response window silently expired for everyone.
 * This view exists so the accused can actually answer.
 *
 * It never invents state: every status, label and "can I still reply?" decision
 * comes from the server's own `status` and `can_respond` fields.
 */
const auth = useAuthStore()
const toast = useToast()

const reports = ref<NoShowReport[]>([])
const loading = ref(true)
const hasError = ref(false)

const responding = ref<NoShowReport | null>(null)
const choice = ref<'accept' | 'dispute'>('accept')
const note = ref('')
const submitting = ref(false)
const error = ref('')

/** Reports still needing an answer float to the top — they are the ones with a clock. */
const sorted = computed(() =>
  [...reports.value].sort((a, b) => Number(b.can_respond) - Number(a.can_respond)),
)

const actionable = computed(() => reports.value.filter((r) => r.can_respond).length)

function deadlineLabel(report: NoShowReport): string | null {
  if (!report.can_respond || !report.response_deadline_at) return null

  const remaining = new Date(report.response_deadline_at).getTime() - Date.now()
  if (remaining <= 0) return 'Javob muddati tugadi'

  const hours = Math.floor(remaining / 3_600_000)
  if (hours >= 24) return `Javob berishga ${Math.floor(hours / 24)} kun qoldi`
  if (hours >= 1) return `Javob berishga ${hours} soat qoldi`

  return `Javob berishga ${Math.max(1, Math.floor(remaining / 60_000))} daqiqa qoldi`
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await noShowApi.mine()
    reports.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function startResponse(report: NoShowReport) {
  responding.value = report
  choice.value = 'accept'
  note.value = ''
  error.value = ''
}

async function submitResponse() {
  if (!responding.value) return

  error.value = ''
  submitting.value = true

  try {
    if (choice.value === 'accept') {
      await noShowApi.accept(responding.value.id, note.value || undefined)
      toast.success('Javobingiz qabul qilindi.')
    } else {
      await noShowApi.dispute(responding.value.id, note.value)
      toast.success("E'tirozingiz yuborildi. Admin ko'rib chiqadi.")
    }

    responding.value = null
    // Re-read rather than patch: accepting and disputing land on different
    // statuses, and the server is the only thing that knows which.
    await load()
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    submitting.value = false
  }
}

// A report filed while this page is open should appear without a refresh.
useEchoChannel(() => (auth.user ? `App.Models.User.${auth.user.id}` : null), {
  listeners: {
    '.NoShowReported': () => void load(),
    '.DisputeResolved': () => void load(),
  },
})

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <h1 class="text-xl md:text-2xl font-bold text-ink pr-14 tablet:pr-0">Menga qarshi shikoyatlar</h1>
      <p class="text-sm text-ink-muted mt-1">
        Shikoyat — hukm emas. Siz javob berishingiz mumkin, va faqat siz tan olganingizda yoki
        admin qaror qabul qilganda ishonch ballingizga ta'sir qiladi.
      </p>

      <div
        v-if="actionable > 0"
        class="mt-4 rounded-2xl bg-warning-bg text-warning px-4 py-3 text-sm font-medium flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="icons.warning" />
        {{ actionable }} ta shikoyat javobingizni kutmoqda
      </div>

      <div v-if="loading" class="mt-5 space-y-3">
        <div v-for="i in 2" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="35%" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" class="mt-5" @retry="load" />

      <EmptyState
        v-else-if="reports.length === 0"
        class="mt-5"
        :icon="icons.trust"
        title="Sizga qarshi shikoyat yo'q"
        description="Bu yaxshi xabar — hech kim sizni kelmagan deb belgilamagan."
      />

      <div v-else class="mt-5 space-y-3">
        <article v-for="report in sorted" :key="report.id" class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-ink">
                {{ report.activity?.title ?? 'Faoliyat' }}
              </p>
              <p v-if="report.activity" class="text-sm text-ink-muted">
                {{ formatActivityStart(report.activity.start_at) }}
              </p>
            </div>
            <StatusBadge
              :status="report.status"
              :labels="noShowStatus.labels"
              :variants="noShowStatus.variants"
              class="shrink-0"
            />
          </div>

          <div v-if="report.reporter" class="flex items-center gap-2 mt-3">
            <Avatar
              :src="report.reporter.profile?.avatar_url"
              :name="report.reporter.name"
              size="sm"
            />
            <span class="text-sm text-ink-muted">
              {{ report.reporter.name }} shikoyat qildi
            </span>
          </div>

          <p v-if="report.reporter_note" class="text-sm text-ink mt-3 bg-surface-muted rounded-xl p-3">
            "{{ report.reporter_note }}"
          </p>

          <p v-if="report.accused_response" class="text-sm text-ink-muted mt-2">
            <span class="font-medium text-ink">Sizning javobingiz:</span>
            {{ report.accused_response }}
          </p>

          <div class="flex items-center justify-between gap-3 mt-3">
            <p class="text-xs text-ink-faint">
              {{ formatDateTime(report.created_at) }}
            </p>
            <p v-if="deadlineLabel(report)" class="text-xs font-medium text-warning">
              {{ deadlineLabel(report) }}
            </p>
          </div>

          <AppButton
            v-if="report.can_respond"
            class="mt-3 w-full"
            @click="startResponse(report)"
          >
            Javob berish
          </AppButton>
        </article>
      </div>
    </div>

    <AppModal v-if="responding" title="Shikoyatga javob" @close="responding = null">
      <div class="space-y-4">
        <p class="text-sm text-ink-muted">
          "{{ responding?.activity?.title }}" faoliyati bo'yicha javobingizni tanlang.
        </p>

        <div class="space-y-2">
          <button
            class="w-full text-left rounded-2xl border p-3 transition"
            :class="choice === 'accept' ? 'border-primary-500 bg-primary-50/50' : 'border-border'"
            @click="choice = 'accept'"
          >
            <p class="font-semibold text-ink">Tan olaman</p>
            <p class="text-sm text-ink-muted">
              Shikoyat darhol tasdiqlanadi va ishonch ballingizga ta'sir qiladi.
            </p>
          </button>

          <button
            class="w-full text-left rounded-2xl border p-3 transition"
            :class="choice === 'dispute' ? 'border-primary-500 bg-primary-50/50' : 'border-border'"
            @click="choice = 'dispute'"
          >
            <p class="font-semibold text-ink">Rozi emasman</p>
            <p class="text-sm text-ink-muted">
              Nizo ochiladi va qarorni admin qabul qiladi. Hech narsa avtomatik hisoblanmaydi.
            </p>
          </button>
        </div>

        <AppTextarea
          v-model="note"
          :label="choice === 'dispute' ? 'Izohingiz (majburiy)' : 'Izoh (ixtiyoriy)'"
          :placeholder="
            choice === 'dispute'
              ? 'Nima bo\'lganini tushuntiring — bu adminning yagona ma\'lumot manbai.'
              : 'Xohlasangiz izoh qoldiring'
          "
          :rows="4"
        />

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <div class="flex gap-2">
          <AppButton variant="ghost" class="flex-1" @click="responding = null">
            Bekor qilish
          </AppButton>
          <AppButton
            class="flex-1"
            :loading="submitting"
            :disabled="choice === 'dispute' && !note.trim()"
            @click="submitResponse"
          >
            Yuborish
          </AppButton>
        </div>
      </div>
    </AppModal>
  </AppLayout>
</template>
