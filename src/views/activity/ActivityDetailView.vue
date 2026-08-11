<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Avatar from '@/components/ui/Avatar.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import { activitiesApi } from '@/api/activities'
import { applicationsApi } from '@/api/applications'
import { matchesApi } from '@/api/matches'
import { invoicesApi } from '@/api/invoices'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { extractErrorMessage } from '@/composables/useApiError'
import { categoryIcon, icons } from '@/lib/icons'
import type { Activity, ActivityMatch, Application, ActivityStatus, Invoice } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()

const activity = ref<Activity | null>(null)
const match = ref<ActivityMatch | null>(null)
const invoices = ref<Invoice[]>([])
const loading = ref(true)
const hasError = ref(false)
const showApplyModal = ref(false)
const message = ref('')
const applying = ref(false)
const myApplication = ref<Application | null>(null)
const error = ref('')
const cancelling = ref(false)
const confirming = ref(false)
const payingInvoiceId = ref<number | null>(null)

const isOwner = computed(() => activity.value?.owner.id === auth.user?.id)

const isParticipant = computed(() => !!activity.value?.my_participant_id)

const paymentLabel = computed(() => {
  if (!activity.value) return ''
  switch (activity.value.payment_type) {
    case 'free':
      return 'Bepul'
    case 'shared_cost':
      return `Umumiy xarajat — ${activity.value.amount.toLocaleString()} UZS / kishi`
    case 'owner_pays':
      return "Sherikka to'lanadi"
    case 'participant_pays':
      return "Siz to'laysiz"
    default:
      return ''
  }
})

const statusLabels: Record<ActivityStatus, string> = {
  draft: 'Qoralama',
  published: "E'lon qilingan",
  full: "To'lgan",
  in_progress: 'Davom etmoqda',
  completed: 'Yakunlangan',
  cancelled: 'Bekor qilingan',
  expired: "Muddati o'tgan",
}

const statusVariants: Record<ActivityStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  published: 'primary',
  full: 'success',
  in_progress: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  expired: 'neutral',
}

const myOwedInvoice = computed(() => invoices.value.find((i) => !['paid', 'cancelled'].includes(i.status)))
const myPaidInvoice = computed(() => invoices.value.find((i) => i.status === 'paid'))

const iHaveConfirmedCompletion = computed(() =>
  isOwner.value ? !!activity.value?.owner_confirmed_completed_at : !!activity.value?.my_participation_confirmed_at,
)

const canConfirmCompletion = computed(
  () =>
    !!activity.value &&
    ['full', 'in_progress'].includes(activity.value.status) &&
    (isOwner.value || isParticipant.value) &&
    !iHaveConfirmedCompletion.value,
)

async function load() {
  loading.value = true
  hasError.value = false
  const activityId = route.params.id as string

  try {
    const [{ data }, myApplications] = await Promise.all([
      activitiesApi.show(activityId),
      applicationsApi.mine().catch(() => ({ data: { data: [] } })),
    ])
    activity.value = data.data
    myApplication.value =
      myApplications.data.data.find(
        (a) => a.activity.id === data.data.id && a.status !== 'cancelled' && a.status !== 'rejected',
      ) ?? null

    if (activity.value.status !== 'published' && activity.value.status !== 'draft') {
      const needsInvoice = !['free', 'shared_cost'].includes(activity.value.payment_type)
      const [matchesRes, invoicesRes] = await Promise.all([
        matchesApi.list(),
        needsInvoice
          ? invoicesApi.mine(activity.value.id).catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] as Invoice[] } }),
      ])
      match.value = matchesRes.data.data.find((m) => m.activity.id === activity.value?.id) ?? null
      invoices.value = invoicesRes.data.data
    }
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function submitApply() {
  if (!activity.value) return
  error.value = ''
  applying.value = true
  try {
    const { data } = await applicationsApi.apply(activity.value.id, message.value || undefined)
    myApplication.value = data.data
    showApplyModal.value = false
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    applying.value = false
  }
}

async function cancelActivity() {
  if (!activity.value) return
  cancelling.value = true
  try {
    const { data } = await activitiesApi.cancel(activity.value.id)
    activity.value = data.data
  } finally {
    cancelling.value = false
  }
}

async function confirmCompletion() {
  if (!activity.value) return
  error.value = ''
  confirming.value = true
  try {
    if (isOwner.value) {
      await activitiesApi.confirmCompletion(activity.value.id)
    } else if (activity.value.my_participant_id) {
      await activitiesApi.confirmParticipantCompletion(activity.value.my_participant_id)
    }
    await load()
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    confirming.value = false
  }
}

async function payInvoice(invoice: Invoice) {
  error.value = ''
  payingInvoiceId.value = invoice.id
  try {
    const { data } = await invoicesApi.pay(invoice.id)
    if (data.data.checkout_url) {
      window.location.href = data.data.checkout_url
      return
    }
    if (activity.value) {
      const { data: invoicesRes } = await invoicesApi.mine(activity.value.id)
      invoices.value = invoicesRes.data
    }
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    payingInvoiceId.value = null
  }
}

const relevantTypes = ['application_accepted', 'application_rejected', 'new_application']

watch(
  () => notifications.notifications[0],
  (latest) => {
    if (!latest || !activity.value) return
    if (!relevantTypes.includes(latest.type)) return
    if (latest.data.activity_id !== activity.value.id) return
    load()
  },
)

onMounted(load)
</script>

<template>
  <AppLayout>
    <div v-if="loading" class="pb-8">
      <Skeleton variant="block" height="14rem" class="w-full md:rounded-b-3xl" />
      <div class="px-4 md:px-8 -mt-6 md:mt-6 relative">
        <div class="card p-5 space-y-3">
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="block" height="3.5rem" />
        </div>
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <div v-else-if="activity" class="pb-8">
      <div v-if="activity.image_url" class="w-full h-56 md:h-72 md:rounded-b-3xl overflow-hidden">
        <img :src="activity.image_url" class="w-full h-full object-cover" />
      </div>
      <div v-else class="w-full h-40 md:h-56 md:rounded-b-3xl bg-primary-50 flex items-center justify-center text-primary-300 text-5xl">
        <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" />
      </div>

      <div class="px-4 md:px-8 -mt-6 md:mt-6 relative">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-[10px]" />
              {{ activity.category.name }}
            </span>
            <StatusBadge
              v-if="activity.status !== 'published'"
              :status="activity.status"
              :labels="statusLabels"
              :variants="statusVariants"
            />
          </div>

          <h1 class="text-xl font-bold text-ink mt-2">{{ activity.title }}</h1>

          <div class="mt-3 space-y-1.5 text-sm text-ink-muted">
            <p class="flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.time" class="text-ink-faint w-4" />
              {{ new Date(activity.start_at).toLocaleString('uz-UZ') }}
            </p>
            <p class="flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.location" class="text-ink-faint w-4" />
              {{ activity.location_name }}
            </p>
            <p class="flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.people" class="text-ink-faint w-4" />
              {{ activity.people_needed }} kishi kerak
            </p>
          </div>

          <div
            class="mt-4 rounded-xl px-4 py-3"
            :class="activity.payment_type === 'free' ? 'bg-surface-muted' : 'bg-primary-50'"
          >
            <p class="font-bold text-lg" :class="activity.payment_type === 'free' ? 'text-ink' : 'text-primary-700'">
              {{ activity.payment_type === 'free' ? 'Bepul' : `${activity.amount.toLocaleString()} UZS` }}
            </p>
            <p class="text-sm" :class="activity.payment_type === 'free' ? 'text-ink-muted' : 'text-primary-500'">
              {{ paymentLabel }}
            </p>
          </div>

          <div v-if="activity.description" class="mt-5">
            <h2 class="font-semibold text-ink mb-1.5">Tavsif</h2>
            <p class="text-sm text-ink-muted leading-relaxed">{{ activity.description }}</p>
          </div>

          <div class="mt-5 pt-5 border-t border-border flex items-center justify-between gap-3">
            <RouterLink :to="{ name: 'user-profile', params: { id: activity.owner.id } }" class="flex items-center gap-3 min-w-0">
              <Avatar :src="activity.owner.profile.avatar_url" :name="activity.owner.name" size="lg" />
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink flex items-center gap-1.5">
                  {{ activity.owner.name }}
                  <VerificationBadge v-if="activity.owner.identity_verified" compact />
                </p>
                <p v-if="activity.owner.rating_average" class="text-sm text-ink-muted flex items-center gap-1">
                  <FontAwesomeIcon :icon="icons.starSolid" class="text-star" />
                  {{ activity.owner.rating_average }} ({{ activity.owner.reviews_count }} sharh)
                </p>
              </div>
            </RouterLink>
            <ReportBlockMenu v-if="!isOwner" :user-id="activity.owner.id" :user-name="activity.owner.name" />
          </div>
        </div>

        <!-- Commission invoice section -->
        <div v-if="match && myOwedInvoice" class="card p-5 mt-4">
          <h2 class="font-semibold text-ink mb-1">Platforma komissiyasi</h2>
          <p class="text-sm text-ink-muted mb-3">
            Faoliyat summasi ({{ activity.amount.toLocaleString() }} UZS) tomonlar o'rtasida hal qilinadi. Rivex faqat
            o'z xizmat haqini oladi.
          </p>
          <div class="rounded-xl bg-primary-50 px-4 py-3 mb-3">
            <p class="font-bold text-lg text-primary-700">{{ myOwedInvoice.amount.toLocaleString() }} UZS</p>
            <p class="text-sm text-primary-500">Komissiya ({{ myOwedInvoice.commission_rate }}%)</p>
          </div>
          <p v-if="error" class="text-sm text-danger mb-3">{{ error }}</p>
          <AppButton :loading="payingInvoiceId === myOwedInvoice.id" @click="payInvoice(myOwedInvoice)">
            To'lash
          </AppButton>
        </div>
        <div v-else-if="match && myPaidInvoice" class="card p-5 mt-4">
          <div class="rounded-xl bg-success-bg text-success px-4 py-3 text-sm font-medium flex items-center gap-2">
            <FontAwesomeIcon :icon="icons.verified" />
            Komissiya to'landi ({{ myPaidInvoice.amount.toLocaleString() }} UZS)
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <template v-if="isOwner">
            <p v-if="error" class="text-sm text-danger">{{ error }}</p>
            <div class="flex gap-3">
              <AppButton
                v-if="activity.status === 'published'"
                variant="outline"
                @click="router.push({ name: 'incoming-applications', params: { id: activity.id } })"
              >
                Arizalarni ko'rish
              </AppButton>
              <AppButton
                v-if="!['cancelled', 'completed'].includes(activity.status)"
                variant="ghost"
                :loading="cancelling"
                :disabled="confirming"
                @click="cancelActivity"
              >
                Bekor qilish
              </AppButton>
            </div>
          </template>
          <template v-else-if="myApplication?.status === 'accepted'">
            <div class="h-12 rounded-xl bg-success-bg text-success font-semibold flex items-center justify-center gap-2">
              <FontAwesomeIcon :icon="icons.verified" />
              Arizangiz qabul qilindi!
            </div>
          </template>
          <template v-else-if="myApplication?.status === 'pending'">
            <div class="h-12 rounded-xl bg-primary-50 text-primary-700 font-semibold flex items-center justify-center gap-2">
              <FontAwesomeIcon :icon="icons.pending" />
              Ariza yuborildi — javobni kuting
            </div>
          </template>
          <template v-else-if="activity.status === 'published'">
            <AppButton @click="showApplyModal = true">Ariza yuborish</AppButton>
          </template>
          <template v-else>
            <div class="h-12 rounded-xl bg-surface-muted text-ink-muted font-semibold flex items-center justify-center">
              Ariza qabul qilinmayapti
            </div>
          </template>

          <AppButton
            v-if="isParticipant && match"
            variant="outline"
            :icon="icons.chat"
            @click="router.push({ name: 'chat-detail', params: { matchId: match.id } })"
          >
            Chatga o'tish
          </AppButton>

          <template v-if="(isOwner || isParticipant) && ['full', 'in_progress'].includes(activity.status)">
            <AppButton
              v-if="canConfirmCompletion"
              variant="outline"
              :icon="icons.completedFlag"
              :loading="confirming"
              @click="confirmCompletion"
            >
              Faoliyat tugadimi? Tasdiqlash
            </AppButton>
            <div
              v-else-if="iHaveConfirmedCompletion"
              class="h-12 rounded-xl bg-surface-muted text-ink-muted text-sm font-medium flex items-center justify-center"
            >
              Siz tasdiqladingiz — boshqa tomon kutilmoqda
            </div>
          </template>
        </div>
      </div>
    </div>

    <AppModal v-if="showApplyModal" title="Ariza yuborish" @close="showApplyModal = false">
      <p class="text-sm text-ink-muted mb-3">Faoliyat egasiga xabar yozing (ixtiyoriy).</p>
      <AppTextarea
        v-model="message"
        :rows="3"
        placeholder="Salom, men ham qatnashmoqchiman..."
        class="mb-3"
      />
      <p v-if="error" class="text-sm text-danger mb-3">{{ error }}</p>
      <AppButton :loading="applying" @click="submitApply">Arizani yuborish</AppButton>
    </AppModal>
  </AppLayout>
</template>
