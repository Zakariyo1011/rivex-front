<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import ImagePicker from '@/components/verification/ImagePicker.vue'
import LocationPicker from '@/components/location/LocationPicker.vue'
import { activitiesApi } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { extractErrorMessage, extractFieldErrors } from '@/composables/useApiError'
import { useVerificationGuard } from '@/composables/useVerificationGuard'
import { useToast } from '@/composables/useToast'
import { categoryIcon, icons } from '@/lib/icons'
import { formatMoney } from '@/lib/datetime'
import {
  MAX_PEOPLE_NEEDED,
  defaultStartAt,
  emptyActivityForm,
  firstStepWithError,
  guidanceFor,
  paymentOptions,
  toActivityPayload,
  validateActivityForm,
  type ActivityFormState,
} from '@/lib/activityForm'
import type { Category, PaymentType } from '@/types'

/**
 * Creating an activity.
 *
 * ## What was wrong with the previous version
 *
 * It did not use `lib/activityForm` at all — the module that exists precisely so
 * the create and edit screens cannot disagree about what an activity is. It
 * carried its own copy of `paymentOptions`, built its own request body, and had
 * **no field validation whatsoever**: the only gate was a disabled "continue"
 * button checking that two strings were non-empty. Everything else was
 * discovered by the server and shown as one line of red text on the last step,
 * with no indication of which field or which step it belonged to.
 *
 * It also seeded the start time from a **UTC** date beside a **local** time, so
 * for the last few hours of every day in UTC+5 the form opened pre-filled with a
 * moment in the past and refused to submit a form nobody had touched.
 *
 * ## Six steps, because there are six decisions
 *
 * What · When · Where · Who · How much · Check. The grouping is not
 * cosmetic: each step is one question a participant will ask, in the order they
 * ask it, and each is short enough to fit a phone screen without scrolling past
 * the button. The old form put location, date, time and headcount on a single
 * step, which is four unrelated decisions and the tallest screen in the app.
 *
 * ## Validation runs per step, and the review step can send you back
 *
 * `validateActivityForm` is advisory — the server is the authority and its
 * rules are asserted in `ActivityCreationTest`. What it buys is that a problem
 * is shown beside the field that has it, on the step that owns it, before a
 * round trip. Server-side field errors are routed the same way through
 * `firstStepWithError`, so a 422 on the last step never leaves somebody reading
 * about a field they cannot see.
 */
const router = useRouter()
const verificationGuard = useVerificationGuard()
const toast = useToast()

const TOTAL_STEPS = 6

const STEPS: readonly { title: string; hint: string }[] = [
  { title: 'Nima qilamiz?', hint: 'Turi va nomi' },
  { title: 'Qachon?', hint: 'Sana va vaqt' },
  { title: 'Qayerda?', hint: 'Uchrashuv joyi' },
  { title: 'Kim va nechta?', hint: 'Ishtirokchilar' },
  { title: "To'lov qanday?", hint: 'Xarajat' },
  { title: "Ko'rib chiqing", hint: "E'lon qilish" },
]

const step = ref(1)

/** Non-null by construction: `step` is clamped to 1..TOTAL_STEPS everywhere. */
const currentStep = computed(() => STEPS[step.value - 1] ?? STEPS[0]!)
const categories = ref<Category[]>([])
const loadingCategories = ref(true)
const submitting = ref(false)
const error = ref('')
const serverErrors = ref<Record<string, string>>({})
/**
 * Steps the user has tried to leave.
 *
 * Starts empty, including step one. Seeding it with the first step meant the
 * wizard opened with "Nom kiritilishi kerak." already in red under an empty
 * field nobody had touched yet — telling somebody they have made a mistake
 * before they have done anything.
 */
const visited = reactive<Set<number>>(new Set())

const form = reactive<ActivityFormState>(emptyActivityForm())

/**
 * The shelf, tracked apart from what gets submitted.
 *
 * `form.category_id` is the single value the API takes and may hold either a
 * root or a child. This only drives which subcategory list is on offer.
 */
const rootCategoryId = ref<number | null>(null)

const subcategories = computed(
  () => categories.value.find((c) => c.id === rootCategoryId.value)?.children ?? [],
)

const selectedRoot = computed(
  () => categories.value.find((c) => c.id === rootCategoryId.value) ?? null,
)

const guidance = computed(() => guidanceFor(selectedRoot.value?.slug))

const localErrors = computed(() => validateActivityForm(form))

/** Server errors win — they are the authority — then the local advisory ones. */
function errorFor(field: string): string | undefined {
  return serverErrors.value[field] ?? localErrors.value[field]
}

/** Only surface an error once its step has actually been seen. */
function shownErrorFor(field: string, ownerStep: number): string | undefined {
  return visited.has(ownerStep) ? errorFor(field) : undefined
}

const FIELDS_BY_STEP: Record<number, string[]> = {
  1: ['title', 'category_id', 'description'],
  2: ['start_at', 'duration_minutes'],
  3: ['location_name', 'region_id', 'district_id', 'latitude'],
  4: ['people_needed'],
  5: ['payment_type', 'amount'],
  6: [],
}

/** Whether the current step is clean enough to move on from. */
const canContinue = computed(() =>
  (FIELDS_BY_STEP[step.value] ?? []).every((field) => !localErrors.value[field]),
)

const isValid = computed(() => Object.keys(localErrors.value).length === 0)

/**
 * Whether this step has anything wrong with it.
 *
 * The line under the button says only that something above needs attention —
 * *what* is already written beside each field it belongs to, and repeating the
 * first of those here made the same sentence appear twice on one screen.
 */
const hasBlockingError = computed(() =>
  (FIELDS_BY_STEP[step.value] ?? []).some((field) => localErrors.value[field]),
)

function next() {
  // The step being *left* is now one the user has had a go at, so its problems
  // may be shown. The step being entered is not — marking it too would open
  // every screen with its fields already flagged red.
  visited.add(step.value)

  if (!canContinue.value) return

  step.value = Math.min(step.value + 1, TOTAL_STEPS)
}

function back() {
  step.value = Math.max(step.value - 1, 1)
}

function goToStep(target: number) {
  // Backwards is always allowed; forwards only through `next()`, so a step is
  // never skipped past its own validation.
  if (target < step.value) step.value = target
}

function onRootCategoryChange(value: string | number | null) {
  rootCategoryId.value = value === null ? null : Number(value)
  // Changing shelf discards the finer choice, which belonged to the old one.
  form.category_id = rootCategoryId.value
}

function onCoordinates(value: { latitude: number; longitude: number } | null) {
  form.latitude = value?.latitude ?? null
  form.longitude = value?.longitude ?? null
}

function adjustPeople(delta: number) {
  form.people_needed = Math.min(
    MAX_PEOPLE_NEEDED,
    Math.max(1, form.people_needed + delta),
  )
}

function selectPayment(value: PaymentType) {
  form.payment_type = value
  // Picking "free" clears an amount typed under a previous choice, so the two
  // can never contradict each other in the payload.
  if (value === 'free') form.amount = 0
}

const selectedPayment = computed(
  () => paymentOptions.find((option) => option.value === form.payment_type) ?? null,
)

const startPreview = computed(() => {
  if (!form.date || !form.time) return null

  const at = new Date(`${form.date}T${form.time}`)

  return Number.isNaN(at.getTime()) ? null : at
})

/**
 * `min` on the date input, so the native picker itself refuses yesterday.
 *
 * Today's real local date, not the default start's — those differ late in the
 * evening, when the suggested start has already rolled over to tomorrow, and
 * using it here would stop somebody scheduling something for tonight.
 */
const today = computed(() => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
})

/**
 * One publish, however many times the button is pressed.
 *
 * `submitting` disables the button, but a disabled button is not a guarantee —
 * a queued keyboard activation, or a second tab, gets past it. The server holds
 * the real line (`StoreActivityRequest`); this stops the common case from ever
 * reaching it.
 */
let inFlight = false

async function publish() {
  visited.add(step.value)

  if (!isValid.value) {
    const target = firstStepWithError(localErrors.value)
    if (target) {
      step.value = target
      for (let i = 1; i <= target; i++) visited.add(i)
    }

    return
  }

  if (inFlight) return
  inFlight = true

  error.value = ''
  serverErrors.value = {}
  submitting.value = true

  try {
    const { data } = await activitiesApi.create(toActivityPayload(form))

    toast.success("Faoliyat e'lon qilindi")
    router.push({ name: 'activity-detail', params: { id: data.data.id } })
  } catch (e) {
    // Paid activities need a verified identity — send them to KYC rather than
    // showing a refusal they cannot act on.
    if (verificationGuard.handle(e)) return

    serverErrors.value = extractFieldErrors(e)
    error.value = extractErrorMessage(e)

    // Land on the step that owns the problem, not on the review screen talking
    // about a field three steps back.
    const target = firstStepWithError(serverErrors.value)
    if (target) step.value = target
  } finally {
    submitting.value = false
    inFlight = false
  }
}

onMounted(async () => {
  const start = defaultStartAt()
  form.date = start.date
  form.time = start.time

  try {
    const { data } = await categoriesApi.tree()
    categories.value = data.data

    if (categories.value[0]) {
      rootCategoryId.value = categories.value[0].id
      form.category_id = categories.value[0].id
    }
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    loadingCategories.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-xl mx-auto pb-10">
      <!-- Header: back, title, and where you are. The step counter is a word
           and a number rather than only a bar, because "3/6" answers "how much
           is left" and the title answers "what is this asking". -->
      <div class="flex items-center gap-3 mb-1">
        <button
          v-if="step > 1"
          type="button"
          class="w-9 h-9 -ml-2 rounded-full text-ink-muted hover:bg-surface-muted flex items-center justify-center transition"
          aria-label="Orqaga"
          @click="back"
        >
          <FontAwesomeIcon :icon="icons.back" />
        </button>
        <h1 class="text-xl font-bold text-ink flex-1 min-w-0">{{ currentStep.title }}</h1>
        <span class="text-sm font-medium text-ink-faint shrink-0">{{ step }}/{{ TOTAL_STEPS }}</span>
      </div>
      <p class="text-sm text-ink-muted mb-5">{{ currentStep.hint }}</p>

      <div class="flex items-center gap-1.5 mb-7">
        <button
          v-for="i in TOTAL_STEPS"
          :key="i"
          type="button"
          class="h-1.5 flex-1 rounded-full transition-colors"
          :class="i <= step ? 'bg-primary-600' : 'bg-border'"
          :aria-label="`${i}-qadam: ${STEPS[i - 1]?.title ?? ''}`"
          :disabled="i >= step"
          @click="goToStep(i)"
        />
      </div>

      <!-- ── 1. What ────────────────────────────────────────────────────── -->
      <div v-if="step === 1" class="space-y-4">
        <AppSelect
          :model-value="rootCategoryId"
          label="Kategoriya"
          placeholder="Kategoriyani tanlang"
          numeric
          :disabled="loadingCategories"
          :options="categories.map((c) => ({ value: c.id, label: c.name }))"
          @update:model-value="onRootCategoryChange"
        />

        <!-- Optional, and only where there is something to choose. Filing an
             activity precisely helps people find it; requiring a second
             decision to publish would not. -->
        <AppSelect
          v-if="subcategories.length"
          v-model="form.category_id"
          label="Aniqroq turi (ixtiyoriy)"
          numeric
          :options="[
            { value: rootCategoryId, label: 'Umumiy' },
            ...subcategories.map((c) => ({ value: c.id, label: c.name })),
          ]"
        />

        <AppInput
          v-model="form.title"
          label="Faoliyat nomi"
          :placeholder="guidance.titleHint"
          :error="shownErrorFor('title', 1)"
          maxlength="150"
        />

        <AppTextarea
          v-model="form.description"
          label="Tavsif (ixtiyoriy)"
          :rows="4"
          :placeholder="guidance.descriptionHint"
          :error="shownErrorFor('description', 1)"
          maxlength="2000"
        />

        <ImagePicker
          v-model="form.image"
          label="Muqova rasmi (ixtiyoriy)"
          empty-label="Rasm qo'shish"
          hint="JPG, PNG yoki WEBP · 4 MB gacha"
          :capture="null"
          :accepted-types="['image/jpeg', 'image/png', 'image/webp']"
          :max-bytes="4 * 1024 * 1024"
        />
      </div>

      <!-- ── 2. When ───────────────────────────────────────────────────── -->
      <div v-else-if="step === 2" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="form.date" label="Sana" type="date" :min="today" />
          <AppInput v-model="form.time" label="Vaqt" type="time" />
        </div>

        <p v-if="shownErrorFor('start_at', 2)" class="-mt-2 text-sm text-danger">
          {{ shownErrorFor('start_at', 2) }}
        </p>
        <p v-else-if="startPreview" class="-mt-2 text-sm text-ink-muted flex items-center gap-2">
          <FontAwesomeIcon :icon="icons.time" class="text-ink-faint" />
          {{
            startPreview.toLocaleDateString('uz-UZ', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
          }},
          {{ form.time }}
        </p>

        <AppInput
          v-model="form.duration_minutes"
          label="Davomiyligi (ixtiyoriy)"
          type="number"
          inputmode="numeric"
          min="15"
          max="1440"
          placeholder="90"
          hint="Daqiqada. Ishtirokchi qancha vaqt ajratishini bilishi uchun."
          :error="shownErrorFor('duration_minutes', 2)"
        />
      </div>

      <!-- ── 3. Where ──────────────────────────────────────────────────── -->
      <div v-else-if="step === 3">
        <LocationPicker
          v-model:region-id="form.region_id"
          v-model:district-id="form.district_id"
          v-model:location-name="form.location_name"
          :latitude="form.latitude"
          :longitude="form.longitude"
          :errors="{
            region_id: shownErrorFor('region_id', 3),
            district_id: shownErrorFor('district_id', 3),
            location_name: shownErrorFor('location_name', 3),
            latitude: shownErrorFor('latitude', 3),
          }"
          @update:coordinates="onCoordinates"
        />
      </div>

      <!-- ── 4. Who ────────────────────────────────────────────────────── -->
      <div v-else-if="step === 4" class="space-y-5">
        <div>
          <p class="text-sm font-medium text-ink-secondary mb-1">
            {{ guidance.peopleHint ?? 'Nechta kishi kerak?' }}
          </p>
          <p class="text-xs text-ink-faint mb-4">
            O'zingizdan tashqari. Joylar to'lganda faoliyat yopiladi.
          </p>

          <div class="flex items-center justify-center gap-6">
            <button
              type="button"
              class="w-12 h-12 rounded-full bg-surface-muted text-ink flex items-center justify-center text-lg disabled:opacity-40 hover:bg-border transition"
              aria-label="Kamaytirish"
              :disabled="form.people_needed <= 1"
              @click="adjustPeople(-1)"
            >
              <FontAwesomeIcon :icon="icons.remove" />
            </button>

            <span class="text-3xl font-bold text-ink w-14 text-center tabular-nums">
              {{ form.people_needed }}
            </span>

            <button
              type="button"
              class="w-12 h-12 rounded-full bg-surface-muted text-ink flex items-center justify-center text-lg disabled:opacity-40 hover:bg-border transition"
              aria-label="Ko'paytirish"
              :disabled="form.people_needed >= MAX_PEOPLE_NEEDED"
              @click="adjustPeople(1)"
            >
              <FontAwesomeIcon :icon="icons.add" />
            </button>
          </div>

          <p v-if="shownErrorFor('people_needed', 4)" class="text-sm text-danger mt-3 text-center">
            {{ shownErrorFor('people_needed', 4) }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2 justify-center">
          <button
            v-for="preset in [1, 2, 3, 5, 10]"
            :key="preset"
            type="button"
            class="h-9 px-4 rounded-full text-sm font-medium transition"
            :class="
              form.people_needed === preset
                ? 'bg-primary-600 text-white'
                : 'bg-surface-muted text-ink-muted hover:bg-border'
            "
            @click="form.people_needed = preset"
          >
            {{ preset }}
          </button>
        </div>
      </div>

      <!-- ── 5. Money ──────────────────────────────────────────────────── -->
      <div v-else-if="step === 5" class="space-y-3">
        <p class="text-sm text-ink-muted">
          Rivex pulni ushlab qolmaydi — hisob-kitob tomonlar o'rtasida bo'ladi.
        </p>

        <button
          v-for="option in paymentOptions"
          :key="option.value"
          type="button"
          class="w-full flex items-center gap-3 p-4 rounded-xl border text-left transition"
          :class="
            form.payment_type === option.value
              ? 'border-primary-500 bg-primary-50'
              : 'border-border bg-surface hover:border-primary-300'
          "
          :aria-pressed="form.payment_type === option.value"
          @click="selectPayment(option.value)"
        >
          <span
            class="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
          >
            <FontAwesomeIcon :icon="option.icon" />
          </span>
          <span class="flex-1 min-w-0">
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

        <AppInput
          v-if="form.payment_type !== 'free'"
          v-model.number="form.amount"
          label="Summa (UZS)"
          type="number"
          inputmode="numeric"
          min="0"
          placeholder="50000"
          class="pt-2"
          :error="shownErrorFor('amount', 5)"
        />
      </div>

      <!-- ── 6. Review ─────────────────────────────────────────────────── -->
      <div v-else class="space-y-4">
        <div class="card overflow-hidden">
          <div class="px-5 pt-5 flex items-center gap-2">
            <span
              class="w-7 h-7 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon :icon="categoryIcon(selectedRoot?.slug ?? '')" class="text-xs" />
            </span>
            <p class="font-bold text-ink truncate">{{ form.title }}</p>
          </div>

          <dl class="px-5 py-4 space-y-3 text-sm">
            <div class="flex items-start gap-3">
              <FontAwesomeIcon :icon="icons.time" class="text-ink-faint w-4 mt-0.5 shrink-0" />
              <dd class="text-ink-secondary">
                {{ form.date }} · {{ form.time }}
                <span v-if="form.duration_minutes" class="text-ink-faint">
                  · {{ form.duration_minutes }} daqiqa
                </span>
              </dd>
            </div>

            <div class="flex items-start gap-3">
              <FontAwesomeIcon :icon="icons.location" class="text-ink-faint w-4 mt-0.5 shrink-0" />
              <dd class="text-ink-secondary min-w-0">
                {{ form.location_name }}
                <span
                  v-if="form.latitude !== null"
                  class="block text-xs text-success mt-0.5"
                >
                  <FontAwesomeIcon :icon="icons.check" class="text-[10px]" />
                  Aniq joy belgilangan
                </span>
              </dd>
            </div>

            <div class="flex items-start gap-3">
              <FontAwesomeIcon :icon="icons.people" class="text-ink-faint w-4 mt-0.5 shrink-0" />
              <dd class="text-ink-secondary">{{ form.people_needed }} kishi kerak</dd>
            </div>

            <div class="flex items-start gap-3">
              <FontAwesomeIcon :icon="icons.amount" class="text-ink-faint w-4 mt-0.5 shrink-0" />
              <dd class="text-ink-secondary">
                {{ form.payment_type === 'free' ? 'Bepul' : formatMoney(form.amount) }}
                <span v-if="selectedPayment && form.payment_type !== 'free'" class="text-ink-faint">
                  · {{ selectedPayment.label }}
                </span>
              </dd>
            </div>
          </dl>

          <p v-if="form.description" class="px-5 pb-5 text-sm text-ink-muted leading-relaxed">
            {{ form.description }}
          </p>
        </div>

        <!-- Anything still wrong, named and clickable. The review step is where
             somebody looks for a reason they cannot publish. -->
        <div
          v-if="!isValid"
          class="rounded-xl border border-danger/30 bg-danger-bg/60 px-4 py-3 text-sm"
        >
          <p class="font-semibold text-danger mb-1">To'ldirilmagan joylar bor</p>
          <ul class="space-y-0.5 text-danger/90">
            <li v-for="(message, field) in localErrors" :key="field">{{ message }}</li>
          </ul>
        </div>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <AppButton :loading="submitting" :disabled="!isValid" @click="publish">
          E'lon qilish
        </AppButton>

        <p class="text-xs text-ink-faint text-center">
          E'lon qilgandan keyin ham tahrirlashingiz mumkin.
        </p>
      </div>

      <!-- One button for every step but the last, which has its own.

           Deliberately NOT disabled while the step is incomplete. A greyed-out
           button is a dead end: it refuses without saying what is missing, and
           on a form where the missing field may be off-screen that leaves
           somebody tapping a button that does nothing. Pressing it reveals the
           errors instead, which is the whole reason `visited` exists. -->
      <div v-if="step < TOTAL_STEPS" class="mt-7 space-y-2">
        <AppButton @click="next">Davom etish</AppButton>

        <p v-if="visited.has(step) && hasBlockingError" class="text-xs text-danger text-center">
          Yuqoridagi maydonlarni to'ldiring.
        </p>
      </div>
    </div>
  </AppLayout>
</template>
