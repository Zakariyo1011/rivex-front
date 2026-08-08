<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { activitiesApi } from '@/api/activities'
import { applicationsApi } from '@/api/applications'
import { matchesApi } from '@/api/matches'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { extractErrorMessage } from '@/composables/useApiError'
import type { Activity, ActivityMatch, Application, Payment } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()

const activity = ref<Activity | null>(null)
const match = ref<ActivityMatch | null>(null)
const payment = ref<Payment | null>(null)
const loading = ref(true)
const showApplyModal = ref(false)
const message = ref('')
const applying = ref(false)
const myApplication = ref<Application | null>(null)
const error = ref('')
const cancelling = ref(false)
const completing = ref(false)
const paying = ref(false)
const selectedRecipientId = ref<number | null>(null)

const isOwner = computed(() => activity.value?.owner.id === auth.user?.id)

const otherParticipants = computed(() => match.value?.participants.filter((p) => p.id !== auth.user?.id) ?? [])

const isParticipant = computed(
  () => !isOwner.value && match.value?.participants.some((p) => p.id === auth.user?.id),
)

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

const canInitiatePayment = computed(() => {
  if (!activity.value || activity.value.payment_type === 'free' || payment.value) return false
  if (activity.value.payment_type === 'owner_pays') return isOwner.value && otherParticipants.value.length > 0
  return isParticipant.value
})

const canComplete = computed(() => activity.value?.payment_type === 'free' || !!payment.value)

const paymentStatusLabel = computed(() => {
  if (!payment.value) return ''
  const amIPayer = payment.value.payer.id === auth.user?.id
  switch (payment.value.status) {
    case 'held':
      return amIPayer ? "To'lov ushlab turilgan — faoliyat tugagach yuboriladi" : "To'lov ushlab turilgan — faoliyat tugagach olasiz"
    case 'released':
      return amIPayer ? "To'lov yuborildi ✓" : "To'lov qabul qilindi ✓"
    case 'refunded':
      return "To'lov qaytarildi"
    default:
      return payment.value.status
  }
})

async function load() {
  loading.value = true
  const activityId = route.params.id as string

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
    const [matchesRes, paymentRes] = await Promise.all([
      matchesApi.list(),
      activity.value.payment_type !== 'free'
        ? activitiesApi.myPayment(activity.value.id).catch(() => ({ data: { data: null } }))
        : Promise.resolve({ data: { data: null } }),
    ])
    match.value = matchesRes.data.data.find((m) => m.activity.id === activity.value?.id) ?? null
    payment.value = paymentRes.data.data
    if (otherParticipants.value.length === 1) selectedRecipientId.value = otherParticipants.value[0].id
  }

  loading.value = false
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

async function completeActivity() {
  if (!activity.value) return
  error.value = ''
  completing.value = true
  try {
    const { data } = await activitiesApi.complete(activity.value.id)
    activity.value = data.data
    if (activity.value.payment_type !== 'free') {
      const paymentRes = await activitiesApi.myPayment(activity.value.id).catch(() => ({ data: { data: null } }))
      payment.value = paymentRes.data.data
    }
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    completing.value = false
  }
}

async function pay() {
  if (!activity.value) return
  error.value = ''
  paying.value = true
  try {
    const { data } = await activitiesApi.pay(activity.value.id, selectedRecipientId.value ?? undefined)
    payment.value = data.data
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    paying.value = false
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
    <div v-if="loading" class="p-8 text-center text-ink-faint">Yuklanmoqda...</div>

    <div v-else-if="activity" class="pb-8">
      <div v-if="activity.image_url" class="w-full h-56 md:h-72 md:rounded-b-3xl overflow-hidden">
        <img :src="activity.image_url" class="w-full h-full object-cover" />
      </div>
      <div v-else class="w-full h-40 md:h-56 md:rounded-b-3xl bg-primary-50 flex items-center justify-center text-6xl">
        {{ activity.category.icon }}
      </div>

      <div class="px-4 md:px-8 -mt-6 md:mt-6 relative">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
              {{ activity.category.icon }} {{ activity.category.name }}
            </span>
            <span
              v-if="activity.status !== 'published'"
              class="text-xs font-semibold px-2.5 py-1 rounded-full"
              :class="{
                'bg-success-bg text-success': activity.status === 'full',
                'bg-danger-bg text-danger': activity.status === 'cancelled',
                'bg-surface-muted text-ink-muted': activity.status === 'completed',
              }"
            >
              {{ activity.status }}
            </span>
          </div>

          <h1 class="text-xl font-bold text-ink mt-2">{{ activity.title }}</h1>

          <div class="mt-3 space-y-1.5 text-sm text-ink-muted">
            <p>🕘 {{ new Date(activity.start_at).toLocaleString('uz-UZ') }}</p>
            <p>📍 {{ activity.location_name }}</p>
            <p>👥 {{ activity.people_needed }} kishi kerak</p>
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

          <div class="mt-5 pt-5 border-t border-border">
            <RouterLink :to="{ name: 'user-profile', params: { id: activity.owner.id } }" class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden">
                <img v-if="activity.owner.profile.avatar_url" :src="activity.owner.profile.avatar_url" class="w-full h-full object-cover" />
                <span v-else>{{ activity.owner.name[0] }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink flex items-center gap-1">
                  {{ activity.owner.name }}
                  <span v-if="activity.owner.identity_verified" class="text-primary-500 text-xs">✓ Tasdiqlangan</span>
                </p>
                <p v-if="activity.owner.rating_average" class="text-sm text-star">
                  ⭐ {{ activity.owner.rating_average }} ({{ activity.owner.reviews_count }} sharh)
                </p>
              </div>
            </RouterLink>
          </div>
        </div>

        <!-- Payment section -->
        <div v-if="match && activity.payment_type !== 'free'" class="card p-5 mt-4">
          <h2 class="font-semibold text-ink mb-3">To'lov</h2>

          <div v-if="payment" class="rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-secondary">
            {{ paymentStatusLabel }}
          </div>

          <template v-else-if="canInitiatePayment">
            <label v-if="isOwner && otherParticipants.length > 1" class="block mb-3">
              <span class="block text-sm font-medium text-ink-secondary mb-1.5">Kimga to'lanadi</span>
              <select
                v-model.number="selectedRecipientId"
                class="w-full h-12 px-4 rounded-xl border border-border bg-white text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option v-for="p in otherParticipants" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>

            <p v-if="error" class="text-sm text-danger mb-3">{{ error }}</p>

            <AppButton :loading="paying" @click="pay">
              {{ activity.amount.toLocaleString() }} UZS to'lash
            </AppButton>
          </template>

          <p v-else class="text-sm text-ink-faint">
            {{ isOwner ? "Sherik to'lovni amalga oshiradi." : "Faoliyat egasi to'lovni amalga oshiradi." }}
          </p>
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
                v-if="['full', 'in_progress'].includes(activity.status)"
                :loading="completing"
                :disabled="cancelling || !canComplete"
                @click="completeActivity"
              >
                Faoliyatni yakunlash
              </AppButton>
              <AppButton
                v-if="!['cancelled', 'completed'].includes(activity.status)"
                variant="ghost"
                :loading="cancelling"
                :disabled="completing"
                @click="cancelActivity"
              >
                Bekor qilish
              </AppButton>
            </div>
            <p
              v-if="['full', 'in_progress'].includes(activity.status) && !canComplete"
              class="text-sm text-ink-faint"
            >
              To'lov amalga oshirilgandan keyin faoliyatni yakunlashingiz mumkin.
            </p>
          </template>
          <template v-else-if="myApplication?.status === 'accepted'">
            <div class="h-12 rounded-xl bg-success-bg text-success font-semibold flex items-center justify-center">
              ✓ Arizangiz qabul qilindi!
            </div>
          </template>
          <template v-else-if="myApplication?.status === 'pending'">
            <div class="h-12 rounded-xl bg-primary-50 text-primary-700 font-semibold flex items-center justify-center">
              ⏳ Ariza yuborildi — javobni kuting
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
            @click="router.push({ name: 'chat-detail', params: { matchId: match.id } })"
          >
            💬 Chatga o'tish
          </AppButton>
        </div>
      </div>
    </div>

    <AppModal v-if="showApplyModal" title="Ariza yuborish" @close="showApplyModal = false">
      <p class="text-sm text-ink-muted mb-3">Faoliyat egasiga xabar yozing (ixtiyoriy).</p>
      <textarea
        v-model="message"
        rows="3"
        placeholder="Salom, men ham qatnashmoqchiman..."
        class="w-full rounded-xl border border-border p-3 text-[15px] outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 mb-3"
      />
      <p v-if="error" class="text-sm text-danger mb-3">{{ error }}</p>
      <AppButton :loading="applying" @click="submitApply">Arizani yuborish</AppButton>
    </AppModal>
  </AppLayout>
</template>
