<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { activitiesApi } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { extractErrorMessage } from '@/composables/useApiError'
import type { Category, PaymentType } from '@/types'

const router = useRouter()

const step = ref(1)
const totalSteps = 4
const categories = ref<Category[]>([])
const submitting = ref(false)
const error = ref('')

const form = reactive({
  title: '',
  category_id: null as number | null,
  description: '',
  location_name: '',
  date: '',
  time: '',
  duration_minutes: '' as string | number,
  people_needed: 1,
  payment_type: 'free' as PaymentType,
  amount: 0,
})

const paymentOptions: { value: PaymentType; label: string; hint: string; icon: string }[] = [
  { value: 'free', label: 'Bepul', hint: "To'lov yo'q", icon: '🆓' },
  { value: 'shared_cost', label: 'Umumiy xarajat', hint: 'Hamma o\'z ulushini to\'laydi', icon: '🤝' },
  { value: 'owner_pays', label: 'Men to\'layman', hint: 'Sherikka men to\'layman', icon: '💸' },
  { value: 'participant_pays', label: 'Sherik to\'laydi', hint: 'Qatnashuvchi menga to\'laydi', icon: '💰' },
]

onMounted(async () => {
  const { data } = await categoriesApi.list()
  categories.value = data.data
  if (categories.value[0]) form.category_id = categories.value[0].id

  const now = new Date(Date.now() + 60 * 60 * 1000)
  form.date = now.toISOString().slice(0, 10)
  form.time = now.toTimeString().slice(0, 5)
})

const canContinueStep1 = computed(() => form.title.trim().length > 0 && form.category_id)
const canContinueStep2 = computed(() => form.location_name.trim().length > 0 && form.date && form.time && form.people_needed > 0)

function next() {
  if (step.value === 1 && !canContinueStep1.value) return
  if (step.value === 2 && !canContinueStep2.value) return
  step.value = Math.min(step.value + 1, totalSteps)
}
function back() {
  step.value = Math.max(step.value - 1, 1)
}

async function publish() {
  error.value = ''
  submitting.value = true
  try {
    const { data } = await activitiesApi.create({
      title: form.title,
      category_id: form.category_id!,
      description: form.description || undefined,
      location_name: form.location_name,
      start_at: `${form.date} ${form.time}:00`,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      people_needed: form.people_needed,
      payment_type: form.payment_type,
      amount: form.payment_type === 'free' ? 0 : form.amount,
    })
    router.push({ name: 'activity-detail', params: { id: data.data.id } })
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-lg mx-auto pb-8">
      <div class="flex items-center gap-3 mb-6">
        <button v-if="step > 1" class="text-ink-muted text-xl" @click="back">←</button>
        <h1 class="text-xl font-bold text-ink">Faoliyat yaratish</h1>
      </div>

      <div class="flex items-center gap-2 mb-8">
        <div
          v-for="i in totalSteps"
          :key="i"
          class="h-1.5 flex-1 rounded-full"
          :class="i <= step ? 'bg-primary-600' : 'bg-border'"
        />
      </div>

      <!-- Step 1 -->
      <div v-if="step === 1" class="space-y-4">
        <AppInput v-model="form.title" label="Faoliyat nomi" placeholder="PS5 FIFA" />

        <label class="block">
          <span class="block text-sm font-medium text-ink-secondary mb-1.5">Kategoriya</span>
          <select
            v-model.number="form.category_id"
            class="w-full h-12 px-4 rounded-xl border border-border bg-white text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
          </select>
        </label>

        <label class="block">
          <span class="block text-sm font-medium text-ink-secondary mb-1.5">Tavsif (ixtiyoriy)</span>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Nima qilmoqchisiz, kimni qidiryapsiz..."
            class="w-full rounded-xl border border-border p-3 text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
          />
        </label>

        <AppButton :disabled="!canContinueStep1" @click="next">Davom etish</AppButton>
      </div>

      <!-- Step 2 -->
      <div v-else-if="step === 2" class="space-y-4">
        <AppInput v-model="form.location_name" label="Manzil" placeholder="PS Arena, Chilonzor" />

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Sana</span>
            <input
              v-model="form.date"
              type="date"
              class="w-full h-12 px-4 rounded-xl border border-border bg-white text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Vaqt</span>
            <input
              v-model="form.time"
              type="time"
              class="w-full h-12 px-4 rounded-xl border border-border bg-white text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
        </div>

        <AppInput
          v-model="form.duration_minutes"
          label="Davomiyligi, daqiqa (ixtiyoriy)"
          placeholder="60"
          type="number"
        />

        <div>
          <span class="block text-sm font-medium text-ink-secondary mb-1.5">Necha kishi kerak</span>
          <div class="flex items-center gap-4">
            <button
              class="w-10 h-10 rounded-full bg-surface-muted text-ink font-bold text-lg"
              @click="form.people_needed = Math.max(1, form.people_needed - 1)"
            >
              −
            </button>
            <span class="text-lg font-semibold w-8 text-center">{{ form.people_needed }}</span>
            <button
              class="w-10 h-10 rounded-full bg-surface-muted text-ink font-bold text-lg"
              @click="form.people_needed += 1"
            >
              +
            </button>
          </div>
        </div>

        <AppButton :disabled="!canContinueStep2" @click="next">Davom etish</AppButton>
      </div>

      <!-- Step 3: Payment type -->
      <div v-else-if="step === 3" class="space-y-3">
        <p class="text-sm text-ink-muted mb-2">To'lov qanday ishlaydi?</p>
        <button
          v-for="option in paymentOptions"
          :key="option.value"
          class="w-full flex items-center gap-3 p-4 rounded-xl border text-left transition"
          :class="form.payment_type === option.value ? 'border-primary-500 bg-primary-50' : 'border-border bg-white'"
          @click="form.payment_type = option.value"
        >
          <span class="text-2xl">{{ option.icon }}</span>
          <span class="flex-1">
            <span class="block font-semibold text-ink">{{ option.label }}</span>
            <span class="block text-sm text-ink-muted">{{ option.hint }}</span>
          </span>
          <span
            v-if="form.payment_type === option.value"
            class="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs"
            >✓</span
          >
        </button>

        <AppButton class="mt-4" @click="next">Davom etish</AppButton>
      </div>

      <!-- Step 4: Amount + Preview -->
      <div v-else-if="step === 4" class="space-y-4">
        <AppInput
          v-if="form.payment_type !== 'free'"
          v-model.number="form.amount"
          label="Summa (UZS)"
          type="number"
          placeholder="50000"
        />

        <div class="card p-4">
          <p class="font-semibold text-ink mb-2">Ko'rib chiqish</p>
          <p class="text-sm text-ink-muted">{{ form.title }}</p>
          <p class="text-sm text-ink-muted">📍 {{ form.location_name }}</p>
          <p class="text-sm text-ink-muted">🕘 {{ form.date }} {{ form.time }}</p>
          <p class="text-sm text-ink-muted">👥 {{ form.people_needed }} kishi kerak</p>
          <p class="text-sm text-ink-muted">
            💰 {{ form.payment_type === 'free' ? 'Bepul' : `${form.amount.toLocaleString()} UZS` }}
          </p>
        </div>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <AppButton :loading="submitting" @click="publish">E'lon qilish</AppButton>
      </div>
    </div>
  </AppLayout>
</template>
