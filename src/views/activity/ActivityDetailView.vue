<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Rating from '@/components/ui/Rating.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import ActivityLocationCard from '@/components/activity/ActivityLocationCard.vue'
import CancelActivityModal from '@/components/activity/CancelActivityModal.vue'
import NoShowReportModal from '@/components/activity/NoShowReportModal.vue'
import ReviewModal from '@/components/activity/ReviewModal.vue'
import { activitiesApi } from '@/api/activities'
import { applicationsApi } from '@/api/applications'
import { conversationsApi } from '@/api/conversations'
import { invoicesApi } from '@/api/invoices'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { useVerificationGuard } from '@/composables/useVerificationGuard'
import { categoryIcon, icons } from '@/lib/icons'
import type {
  Activity,
  ActivityStatus,
  Application,
  CancellationReason,
  Invoice,
  User,
} from '@/types'
import { formatActivityStartLong, formatMoney } from '@/lib/datetime'
import { activityStatus, cancellationReasons } from '@/lib/statusLabels'
import { userProfileRoute } from '@/lib/userLink'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const verificationGuard = useVerificationGuard()

const activity = ref<Activity | null>(null)
/**
 * The conversation this activity's chat lives in, once one exists.
 *
 * Asked of the server rather than derived: a two-person activity routes to the
 * pair's *direct* conversation, which carries no activity_id and so cannot be
 * picked out of a list client-side. 404 simply means no chat yet.
 */
const conversationId = ref<number | null>(null)
const invoices = ref<Invoice[]>([])
const loading = ref(true)
const hasError = ref(false)
const showApplyModal = ref(false)
const message = ref('')
const applying = ref(false)
const myApplication = ref<Application | null>(null)
const error = ref('')
const showCancelModal = ref(false)
const noShowTarget = ref<User | null>(null)
const reviewTarget = ref<User | null>(null)

/**
 * Server-computed: who the caller may still review here. Empty for anyone who
 * did not take part, and it shrinks as reviews are submitted.
 */
const reviewableUsers = computed(() => activity.value?.my_reviewable_users ?? [])

function onReviewSubmitted(revieweeId: number) {
  reviewTarget.value = null

  // Drop the person locally so the prompt updates at once; the next load
  // re-reads the authoritative list from the server anyway.
  if (activity.value?.my_reviewable_users) {
    activity.value.my_reviewable_users = activity.value.my_reviewable_users.filter(
      (u) => u.id !== revieweeId,
    )
  }
}
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
      return `Umumiy xarajat — ${formatMoney(activity.value.amount)} / kishi`
    case 'owner_pays':
      return "Sherikka to'lanadi"
    case 'participant_pays':
      return "Siz to'laysiz"
    default:
      return ''
  }
})

const myOwedInvoice = computed(() =>
  invoices.value.find((i) => !['paid', 'cancelled'].includes(i.status)),
)
const myPaidInvoice = computed(() => invoices.value.find((i) => i.status === 'paid'))

const iHaveConfirmedCompletion = computed(() =>
  isOwner.value
    ? !!activity.value?.owner_confirmed_completed_at
    : !!activity.value?.my_participation_confirmed_at,
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
        (a) =>
          a.activity.id === data.data.id && a.status !== 'cancelled' && a.status !== 'rejected',
      ) ?? null

    // The chat is asked for regardless of the activity's status, and the
    // endpoint's own 404 is the answer to "is there one yet".
    //
    // This used to be gated on the activity having left `published`, which was
    // a stale coupling: a conversation exists the moment one person is
    // accepted, long before an activity fills up. A participant on a
    // half-full activity therefore had a chat, saw it in their chat list, and
    // found no way into it from the activity itself.
    const conversationRes = await conversationsApi.forActivity(activity.value.id).catch(() => null)
    conversationId.value = conversationRes?.data.data.id ?? null

    // Invoices, on the other hand, genuinely only exist once someone has been
    // accepted onto a paid activity.
    if (activity.value.status !== 'published' && activity.value.status !== 'draft') {
      const needsInvoice = !['free', 'shared_cost'].includes(activity.value.payment_type)
      const invoicesRes = needsInvoice
        ? await invoicesApi.mine(activity.value.id).catch(() => ({ data: { data: [] } }))
        : { data: { data: [] as Invoice[] } }

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
    // A verification refusal is not an error to display — it is a redirect to
    // the screen that unblocks the user.
    if (verificationGuard.handle(e)) return
    error.value = extractErrorMessage(e)
  } finally {
    applying.value = false
  }
}

/** Cancelling now needs a reason, so it goes through a modal. */
function onCancelled(updated: Activity) {
  activity.value = updated
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

const cancellationLabel = computed(
  () =>
    cancellationReasons.find((r) => r.value === activity.value?.cancellation_reason)?.label ?? null,
)

/**
 * Live updates for this activity.
 *
 * This used to watch the head of the notification list and re-fetch when a
 * relevant one appeared — a workaround from before activity events existed. It
 * only worked for the three notification types it knew about, fired a full
 * reload for each, and did nothing at all for the organiser cancelling or the
 * scheduler starting the activity. It is replaced by the real channel.
 *
 * Only owner and accepted participants are authorised on `activity.{id}`, so a
 * browsing stranger simply gets no live updates — which is the correct
 * privacy answer, not a gap.
 */
useEchoChannel(() => (activity.value ? `activity.${activity.value.id}` : null), {
  listeners: {
    '.ActivityStatusChanged': (payload: { status: ActivityStatus }) => {
      if (activity.value) activity.value.status = payload.status
    },
    '.ActivityCancelled': (payload: {
      status: ActivityStatus
      cancellation_reason: CancellationReason | null
      cancellation_note: string | null
      cancelled_at: string | null
    }) => {
      if (!activity.value) return

      activity.value.status = payload.status
      activity.value.cancellation_reason = payload.cancellation_reason
      activity.value.cancellation_note = payload.cancellation_note
      activity.value.cancelled_at = payload.cancelled_at

      toast.info('Bu faoliyat bekor qilindi.')
    },
    // A new participant changes the roster and possibly the invoice, both of
    // which come from the server rather than being guessable here.
    '.ParticipantJoined': () => void load(),
    '.MatchCreated': () => void load(),
  },
})

// Anything that happened while the socket was down was missed outright.
onEchoReconnect(() => {
  if (activity.value) void load()
})

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
      <div
        v-else
        class="w-full h-40 md:h-56 md:rounded-b-3xl bg-primary-50 flex items-center justify-center text-primary-300 text-5xl"
      >
        <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" />
      </div>

      <div class="px-4 md:px-8 -mt-6 md:mt-6 relative">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-1">
            <span
              class="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full flex items-center gap-1.5"
            >
              <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-[10px]" />
              {{ activity.category.name }}
            </span>
            <StatusBadge
              v-if="activity.status !== 'published'"
              :status="activity.status"
              :labels="activityStatus.labels"
              :variants="activityStatus.variants"
            />
          </div>

          <h1 class="text-xl font-bold text-ink mt-2">{{ activity.title }}</h1>

          <div class="mt-3 space-y-1.5 text-sm text-ink-muted">
            <p class="flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.time" class="text-ink-faint w-4" />
              {{ formatActivityStartLong(activity.start_at) }}
            </p>
            <p class="flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.people" class="text-ink-faint w-4" />
              {{ activity.people_needed }} kishi kerak
            </p>
          </div>

          <!-- Meeting point, with an opt-in map. Replaces the plain location
               line above; the organiser's home location is never shown. -->
          <ActivityLocationCard :activity="activity" class="mt-4" />

          <div
            v-if="activity.status === 'cancelled'"
            class="mt-4 rounded-xl bg-danger-bg text-danger px-4 py-3 text-sm"
          >
            <p class="font-semibold">Bu faoliyat bekor qilingan</p>
            <p v-if="cancellationLabel" class="mt-0.5">Sababi: {{ cancellationLabel }}</p>
            <p v-if="activity.cancellation_note" class="mt-0.5 opacity-90">
              {{ activity.cancellation_note }}
            </p>
          </div>

          <div
            class="mt-4 rounded-xl px-4 py-3"
            :class="activity.payment_type === 'free' ? 'bg-surface-muted' : 'bg-primary-50'"
          >
            <p
              class="font-bold text-lg"
              :class="activity.payment_type === 'free' ? 'text-ink' : 'text-primary-700'"
            >
              {{ activity.payment_type === 'free' ? 'Bepul' : formatMoney(activity.amount) }}
            </p>
            <p
              class="text-sm"
              :class="activity.payment_type === 'free' ? 'text-ink-muted' : 'text-primary-500'"
            >
              {{ paymentLabel }}
            </p>
          </div>

          <div v-if="activity.description" class="mt-5">
            <h2 class="font-semibold text-ink mb-1.5">Tavsif</h2>
            <p class="text-sm text-ink-muted leading-relaxed">{{ activity.description }}</p>
          </div>

          <div class="mt-5 pt-5 border-t border-border flex items-center justify-between gap-3">
            <RouterLink
              :to="userProfileRoute(activity.owner)!"
              class="flex items-center gap-3 min-w-0"
            >
              <Avatar
                :src="activity.owner.profile.avatar_url"
                :name="activity.owner.name"
                size="lg"
              />
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink flex items-center gap-1.5">
                  {{ activity.owner.name }}
                  <VerificationBadge v-if="activity.owner.identity_verified" compact />
                </p>
                <Rating
                  v-if="activity.owner.rating_average"
                  :value="activity.owner.rating_average"
                  :count="activity.owner.reviews_count"
                />
              </div>
            </RouterLink>
            <ReportBlockMenu
              v-if="!isOwner"
              :user-id="activity.owner.id"
              :user-name="activity.owner.name"
            />
          </div>
        </div>

        <!-- Commission invoice section -->
        <div v-if="conversationId && myOwedInvoice" class="card p-5 mt-4">
          <h2 class="font-semibold text-ink mb-1">Platforma komissiyasi</h2>
          <p class="text-sm text-ink-muted mb-3">
            Faoliyat summasi ({{ formatMoney(activity.amount) }}) tomonlar o'rtasida hal qilinadi.
            Rivex faqat o'z xizmat haqini oladi.
          </p>
          <div class="rounded-xl bg-primary-50 px-4 py-3 mb-3">
            <p class="font-bold text-lg text-primary-700">
              {{ formatMoney(myOwedInvoice.amount) }}
            </p>
            <p class="text-sm text-primary-500">Komissiya ({{ myOwedInvoice.commission_rate }}%)</p>
          </div>
          <p v-if="error" class="text-sm text-danger mb-3">{{ error }}</p>
          <AppButton
            :loading="payingInvoiceId === myOwedInvoice.id"
            @click="payInvoice(myOwedInvoice)"
          >
            To'lash
          </AppButton>
        </div>
        <div v-else-if="conversationId && myPaidInvoice" class="card p-5 mt-4">
          <div
            class="rounded-xl bg-success-bg text-success px-4 py-3 text-sm font-medium flex items-center gap-2"
          >
            <FontAwesomeIcon :icon="icons.verified" />
            Komissiya to'landi ({{ formatMoney(myPaidInvoice.amount) }})
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
                v-if="!['cancelled', 'completed', 'expired'].includes(activity.status)"
                variant="ghost"
                :disabled="confirming"
                @click="showCancelModal = true"
              >
                Bekor qilish
              </AppButton>
            </div>
          </template>
          <template v-else-if="myApplication?.status === 'accepted'">
            <div
              class="h-12 rounded-xl bg-success-bg text-success font-semibold flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon :icon="icons.verified" />
              Arizangiz qabul qilindi!
            </div>
          </template>
          <template v-else-if="myApplication?.status === 'pending'">
            <div
              class="h-12 rounded-xl bg-primary-50 text-primary-700 font-semibold flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon :icon="icons.pending" />
              Ariza yuborildi — javobni kuting
            </div>
          </template>
          <template v-else-if="activity.status === 'published'">
            <AppButton @click="showApplyModal = true">Ariza yuborish</AppButton>
          </template>
          <template v-else>
            <div
              class="h-12 rounded-xl bg-surface-muted text-ink-muted font-semibold flex items-center justify-center"
            >
              Ariza qabul qilinmayapti
            </div>
          </template>

          <AppButton
            v-if="isParticipant && conversationId"
            variant="outline"
            :icon="icons.chat"
            @click="router.push({ name: 'chat-detail', params: { conversationId } })"
          >
            Chatga o'tish
          </AppButton>

          <template
            v-if="(isOwner || isParticipant) && ['full', 'in_progress'].includes(activity.status)"
          >
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

      <!-- Review prompt. The list is server-computed, so it appears only when
           the activity is completed and the caller genuinely took part, and it
           empties itself as reviews are submitted. -->
      <div v-if="reviewableUsers.length > 0" class="px-4 md:px-8 mt-4">
        <div class="card p-5">
          <h2 class="font-semibold text-ink">Uchrashuv qanday o'tdi?</h2>
          <p class="text-sm text-ink-muted mt-1 mb-3">
            Bahoyingiz boshqalarga kim bilan uchrashayotganini tushunishga yordam beradi.
          </p>

          <div class="space-y-2">
            <div
              v-for="person in reviewableUsers"
              :key="person.id"
              class="flex items-center gap-3 rounded-xl bg-surface-muted p-3"
            >
              <Avatar :src="person.profile?.avatar_url" :name="person.name" size="sm" />
              <p class="flex-1 min-w-0 font-medium text-ink truncate">{{ person.name }}</p>
              <button
                class="text-sm font-semibold text-primary-600 hover:underline shrink-0"
                @click="reviewTarget = person"
              >
                Baho berish
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CancelActivityModal
      v-if="showCancelModal && activity"
      :activity="activity"
      @close="showCancelModal = false"
      @cancelled="onCancelled"
    />

    <NoShowReportModal
      v-if="noShowTarget && activity"
      :activity-id="activity.id"
      :person="noShowTarget"
      @close="noShowTarget = null"
    />

    <ReviewModal
      v-if="reviewTarget && activity"
      :activity-id="activity.id"
      :reviewee="reviewTarget"
      @close="reviewTarget = null"
      @submitted="onReviewSubmitted"
    />

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
