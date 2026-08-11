<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import { activitiesApi } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { locationsApi } from '@/api/locations'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { Category, District, PaymentType, Region } from '@/types'

const router = useRouter()

const step = ref(1)
const totalSteps = 4
const categories = ref<Category[]>([])
const regions = ref<Region[]>([])
const districts = ref<District[]>([])
const submitting = ref(false)
const error = ref('')

const form = reactive({
  title: '',
  category_id: null as number | null,
  description: '',
  location_name: '',
  region_id: null as number | null,
  district_id: null as number | null,
  date: '',
  time: '',
  duration_minutes: '' as string | number,
  people_needed: 1,
  payment_type: 'free' as PaymentType,
  amount: 0,
})

async function onRegionChange() {
  form.district_id = null
  districts.value = []
  if (form.region_id) {
    const { data } = await locationsApi.districts(form.region_id)
    districts.value = data.data
  }
}

const paymentOptions: { value: PaymentType; label: string; hint: string; icon: IconDefinition }[] = [
  { value: 'free', label: 'Bepul', hint: "To'lov yo'q", icon: icons.free },
  { value: 'shared_cost', label: 'Umumiy xarajat', hint: "Hamma o'z ulushini to'laydi", icon: icons.amount },
  { value: 'owner_pays', label: "Men to'layman", hint: "Sherikka men to'layman", icon: icons.ownerPays },
  { value: 'participant_pays', label: "Sherik to'laydi", hint: "Qatnashuvchi menga to'laydi", icon: icons.payment },
]

onMounted(async () => {
  try {
    const [{ data: categoriesData }, { data: regionsData }] = await Promise.all([
      categoriesApi.list(),
      locationsApi.regions(),
    ])
    categories.value = categoriesData.data
    if (categories.value[0]) form.category_id = categories.value[0].id
    regions.value = regionsData.data
  } catch (e) {
    error.value = extractErrorMessage(e)
  }

  const now = new Date(Date.now() + 60 * 60 * 1000)
  form.date = now.toISOString().slice(0, 10)
  form.time = now.toTimeString().slice(0, 5)
})

const canContinueStep1 = computed(() => form.title.trim().length > 0 && form.category_id)
const canContinueStep2 = computed(
  () => form.location_name.trim().length > 0 && !!form.region_id && form.date && form.time && form.people_needed > 0,
)

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
      region_id: form.region_id!,
      district_id: form.district_id ?? undefined,
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
        <button v-if="step > 1" class="text-ink-muted text-lg" @click="back">
          <FontAwesomeIcon :icon="icons.back" />
        </button>
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
            class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <AppTextarea
          v-model="form.description"
          label="Tavsif (ixtiyoriy)"
          :rows="3"
          placeholder="Nima qilmoqchisiz, kimni qidiryapsiz..."
        />

        <AppButton :disabled="!canContinueStep1" @click="next">Davom etish</AppButton>
      </div>

      <!-- Step 2 -->
      <div v-else-if="step === 2" class="space-y-4">
        <AppInput v-model="form.location_name" label="Manzil" placeholder="PS Arena, Chilonzor" />

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Viloyat</span>
            <select
              v-model.number="form.region_id"
              class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
              @change="onRegionChange"
            >
              <option :value="null" disabled>Tanlang</option>
              <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Tuman</span>
            <select
              v-model.number="form.district_id"
              :disabled="!form.region_id"
              class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-surface-muted disabled:text-ink-faint"
            >
              <option :value="null">Ixtiyoriy</option>
              <option v-for="d in districts" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Sana</span>
            <input
              v-model="form.date"
              type="date"
              class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Vaqt</span>
            <input
              v-model="form.time"
              type="time"
              class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
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
              class="w-10 h-10 rounded-full bg-surface-muted text-ink flex items-center justify-center"
              @click="form.people_needed = Math.max(1, form.people_needed - 1)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>
            <span class="text-lg font-semibold w-8 text-center">{{ form.people_needed }}</span>
            <button
              class="w-10 h-10 rounded-full bg-surface-muted text-ink flex items-center justify-center"
              @click="form.people_needed += 1"
            >
              <FontAwesomeIcon :icon="icons.add" />
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
          :class="form.payment_type === option.value ? 'border-primary-500 bg-primary-50' : 'border-border bg-surface'"
          @click="form.payment_type = option.value"
        >
          <span class="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="option.icon" />
          </span>
          <span class="flex-1">
            <span class="block font-semibold text-ink">{{ option.label }}</span>
            <span class="block text-sm text-ink-muted">{{ option.hint }}</span>
          </span>
          <span
            v-if="form.payment_type === option.value"
            class="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs shrink-0"
          >
            <FontAwesomeIcon :icon="icons.check" />
          </span>
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

        <div class="card p-4 space-y-1.5">
          <p class="font-semibold text-ink mb-1">Ko'rib chiqish</p>
          <p class="text-sm text-ink-muted">{{ form.title }}</p>
          <p class="text-sm text-ink-muted flex items-center gap-2">
            <FontAwesomeIcon :icon="icons.location" class="text-ink-faint w-4" /> {{ form.location_name }}
          </p>
          <p class="text-sm text-ink-muted flex items-center gap-2">
            <FontAwesomeIcon :icon="icons.time" class="text-ink-faint w-4" /> {{ form.date }} {{ form.time }}
          </p>
          <p class="text-sm text-ink-muted flex items-center gap-2">
            <FontAwesomeIcon :icon="icons.people" class="text-ink-faint w-4" /> {{ form.people_needed }} kishi kerak
          </p>
          <p class="text-sm text-ink-muted flex items-center gap-2">
            <FontAwesomeIcon :icon="icons.amount" class="text-ink-faint w-4" />
            {{ form.payment_type === 'free' ? 'Bepul' : `${form.amount.toLocaleString()} UZS` }}
          </p>
        </div>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <AppButton :loading="submitting" @click="publish">E'lon qilish</AppButton>
      </div>
    </div>
  </AppLayout>
</template>
