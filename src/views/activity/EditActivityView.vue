<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { activitiesApi } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { extractErrorMessage, extractFieldErrors } from '@/composables/useApiError'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { activityStatus } from '@/lib/statusLabels'
import { formatDuration, formatMoney } from '@/lib/datetime'
import { icons } from '@/lib/icons'
import {
  formDurationMinutes,
  emptyActivityForm,
  fromActivity,
  guidanceFor,
  paymentOptions,
  toActivityPayload,
  validateActivityForm,
  type ActivityFormState,
} from '@/lib/activityForm'
import LocationPicker from '@/components/location/LocationPicker.vue'
import type { Activity, Category, PaymentType } from '@/types'

/**
 * Editing an activity.
 *
 * There was no such screen: `PUT /activities/{id}` and `UpdateActivityRequest`
 * had existed since the domain was built, and nothing in the client called
 * them. An organiser who mistyped a time had to cancel and start again.
 *
 * ## Why this is one page and creating is a wizard
 *
 * They are different jobs. Creating walks somebody through decisions they have
 * not made yet, so it is staged. Editing begins with the person already knowing
 * the one thing they came to change, so staging it would make them page past
 * four screens to fix a typo. The *layout* differs; the meaning of the fields
 * does not, and everything that carries meaning — payment types, the payload
 * shape, what counts as valid — comes from `lib/activityForm` so there is one
 * copy of it rather than one per screen.
 *
 * ## The backend is the authority
 *
 * Two rules are enforced server-side and merely *shown* here: a finalised
 * activity cannot be edited at all (`ActivityPolicy::update`), and
 * `people_needed` cannot drop below the people already accepted
 * (`UpdateActivityRequest`). The form disables and explains rather than
 * pretending the rules are its own.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
/** Server-side field errors from the last save, cleared on the next one. */
const fieldErrors = ref<Record<string, string>>({})

const activity = ref<Activity | null>(null)
const categories = ref<Category[]>([])

const loading = ref(true)
const hasError = ref(false)
const saving = ref(false)
const error = ref('')

const form = reactive<ActivityFormState>(emptyActivityForm())

function onCoordinates(value: { latitude: number; longitude: number } | null) {
  form.latitude = value?.latitude ?? null
  form.longitude = value?.longitude ?? null
}

const isOwner = computed(() => !!activity.value && activity.value.owner?.id === auth.user?.id)

/** The server refuses edits once an activity is finalised; this says so first. */
const isFinal = computed(() =>
  ['completed', 'cancelled', 'expired'].includes(activity.value?.status ?? ''),
)

/**
 * The floor on `people_needed`, mirroring the server rule.
 *
 * Derived from the seats already taken. `people_needed` minus the remaining
 * capacity is not available on this payload, so the accepted count is read from
 * the activity's own participant count where the server sends it, and falls
 * back to 1 — the form never claims a *lower* floor than the server enforces,
 * so the worst case is a refusal explained by the API rather than by the field.
 */
const minPeople = computed(() => Math.max(1, activity.value?.accepted_participants_count ?? 1))

const selectedCategory = computed(() => {
  const id = form.category_id
  if (!id) return null

  for (const root of categories.value) {
    if (root.id === id) return root
    const child = root.children?.find((c) => c.id === id)
    if (child) return root
  }

  return null
})

const guidance = computed(() => guidanceFor(selectedCategory.value?.slug))

const rootCategoryId = ref<number | null>(null)
const subcategories = computed(
  () => categories.value.find((c) => c.id === rootCategoryId.value)?.children ?? [],
)

function onRootCategoryChange() {
  form.category_id = rootCategoryId.value
}

const localErrors = computed(() => validateActivityForm(form, { minPeople: minPeople.value }))

/** "18:00 — 20:00 · 2 soat", once both ends are set and agree. */
const timeRangeLabel = computed(() => {
  const minutes = formDurationMinutes(form)

  if (!form.time || !form.end_time || minutes === null || minutes <= 0) return null

  const duration = formatDuration(minutes)

  return duration
    ? `${form.time} — ${form.end_time} · ${duration}`
    : `${form.time} — ${form.end_time}`
})
const isValid = computed(() => Object.keys(localErrors.value).length === 0)

/** Server errors win — they are the authority — then the local advisory ones. */
function errorFor(field: string): string | undefined {
  return fieldErrors.value[field] ?? localErrors.value[field]
}

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const [{ data }, cats] = await Promise.all([
      activitiesApi.show(route.params.id as string),
      categoriesApi.tree(),
    ])

    activity.value = data.data
    categories.value = cats.data.data

    Object.assign(form, fromActivity(data.data))

    rootCategoryId.value =
      categories.value.find(
        (c) => c.id === form.category_id || c.children?.some((x) => x.id === form.category_id),
      )?.id ?? null
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!activity.value || !isValid.value) return

  error.value = ''
  fieldErrors.value = {}
  saving.value = true

  try {
    const { data } = await activitiesApi.update(activity.value.id, toActivityPayload(form))
    toast.success('Saqlandi')
    router.push({ name: 'activity-detail', params: { id: data.data.id } })
  } catch (e) {
    fieldErrors.value = extractFieldErrors(e)
    error.value = extractErrorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Faoliyatni tahrirlash</h1>
    </template>

    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-2xl pb-10">
      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-5">Faoliyatni tahrirlash</h1>

      <div v-if="loading" class="space-y-4">
        <AppCard v-for="i in 3" :key="i">
          <Skeleton variant="text" width="40%" class="mb-3" />
          <Skeleton variant="text" width="90%" />
        </AppCard>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <template v-else-if="activity">
        <!-- The two refusals the server will make, said before the attempt. -->
        <AppCard v-if="!isOwner" class="mb-4">
          <p class="text-sm text-ink-secondary">
            Bu faoliyatni faqat tashkilotchi tahrirlay oladi.
          </p>
        </AppCard>

        <AppCard v-else-if="isFinal" class="mb-4">
          <p class="font-semibold text-ink mb-1">
            {{ activityStatus.labels[activity.status] }}
          </p>
          <p class="text-sm text-ink-secondary">
            Yakunlangan, bekor qilingan yoki muddati o'tgan faoliyatni tahrirlab bo'lmaydi.
          </p>
          <AppButton
            variant="outline"
            class="mt-3"
            @click="router.push({ name: 'activity-detail', params: { id: activity.id } })"
          >
            Faoliyatga qaytish
          </AppButton>
        </AppCard>

        <form v-else class="space-y-4" @submit.prevent="save">
          <!-- 1. Basic information -->
          <AppCard>
            <h2 class="font-semibold text-ink mb-4">Asosiy ma'lumotlar</h2>

            <div class="space-y-4">
              <label class="block">
                <span class="block text-sm font-medium text-ink-secondary mb-1.5">Turi</span>
                <select
                  v-model="rootCategoryId"
                  class="w-full h-11 px-3 rounded-xl border border-border bg-surface text-ink"
                  @change="onRootCategoryChange"
                >
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </label>

              <label v-if="subcategories.length" class="block">
                <span class="block text-sm font-medium text-ink-secondary mb-1.5">
                  Aniqroq turi
                </span>
                <select
                  v-model="form.category_id"
                  class="w-full h-11 px-3 rounded-xl border border-border bg-surface text-ink"
                >
                  <option :value="rootCategoryId">Umumiy</option>
                  <option v-for="c in subcategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </label>

              <AppInput
                v-model="form.title"
                label="Nom"
                :placeholder="guidance.titleHint"
                :error="errorFor('title')"
                maxlength="150"
              />

              <AppTextarea
                v-model="form.description"
                label="Tavsif"
                :placeholder="guidance.descriptionHint"
                :error="errorFor('description')"
                :rows="4"
                maxlength="2000"
              />
            </div>
          </AppCard>

          <!-- 2. Date & time -->
          <AppCard>
            <h2 class="font-semibold text-ink mb-4">Sana va vaqt</h2>

            <AppInput v-model="form.date" label="Sana" type="date" :error="errorFor('start_at')" />

            <!-- Start and end, the same pair the create wizard collects and the
                 same pair the API stores. Editing is one page rather than a
                 wizard, but the MEANING of a field must not differ between the
                 two screens — see lib/activityForm. -->
            <div class="grid grid-cols-2 gap-3 mt-3">
              <AppInput
                v-model="form.time"
                label="Boshlanish vaqti"
                type="time"
                data-testid="activity-start-time"
              />
              <AppInput
                v-model="form.end_time"
                label="Tugash vaqti"
                type="time"
                data-testid="activity-end-time"
                :error="errorFor('ends_at')"
              />
            </div>

            <p
              v-if="timeRangeLabel && !errorFor('ends_at')"
              class="mt-2 text-sm text-ink-muted flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="icons.time" class="text-ink-faint" />
              {{ timeRangeLabel }}
            </p>
          </AppCard>

          <!-- 3. Location -->
          <AppCard>
            <h2 class="font-semibold text-ink mb-4">Joylashuv</h2>

            <!-- The same picker the create wizard uses. It was three hand-rolled
                 selects here and three more there, and neither copy could set a
                 coordinate — which is why no activity in the database had one and
                 "near me" could not match anything. -->
            <LocationPicker
              v-model:region-id="form.region_id"
              v-model:district-id="form.district_id"
              v-model:location-name="form.location_name"
              :latitude="form.latitude"
              :longitude="form.longitude"
              :errors="{
                region_id: errorFor('region_id'),
                district_id: errorFor('district_id'),
                location_name: errorFor('location_name'),
                latitude: errorFor('latitude'),
              }"
              @update:coordinates="onCoordinates"
            />
          </AppCard>

          <!-- 4. Participants -->
          <AppCard>
            <h2 class="font-semibold text-ink mb-4">Ishtirokchilar</h2>

            <AppInput
              v-model.number="form.people_needed"
              :label="guidance.peopleHint ?? 'Nechta kishi kerak?'"
              type="number"
              inputmode="numeric"
              :min="minPeople"
              max="50"
              :error="errorFor('people_needed')"
            />

            <p v-if="minPeople > 1" class="text-xs text-ink-faint mt-1.5">
              Allaqachon {{ minPeople }} ta ishtirokchi qabul qilingan — sonni bundan kam qilib
              bo'lmaydi.
            </p>
          </AppCard>

          <!-- 5. Payment -->
          <AppCard>
            <h2 class="font-semibold text-ink mb-4">To'lov</h2>

            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="option in paymentOptions"
                :key="option.value"
                type="button"
                class="flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-colors"
                :class="
                  form.payment_type === option.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-border bg-surface hover:border-primary-300'
                "
                :aria-pressed="form.payment_type === option.value"
                @click="form.payment_type = option.value as PaymentType"
              >
                <FontAwesomeIcon :icon="option.icon" class="text-primary-600 text-sm" />
                <span class="text-sm font-medium text-ink">{{ option.label }}</span>
                <span class="text-xs text-ink-muted">{{ option.hint }}</span>
              </button>
            </div>

            <AppInput
              v-if="form.payment_type !== 'free'"
              v-model.number="form.amount"
              label="Summa (UZS)"
              type="number"
              inputmode="numeric"
              min="0"
              class="mt-3"
              :error="errorFor('amount')"
            />

            <p v-if="form.payment_type !== 'free' && form.amount > 0" class="text-xs text-ink-faint mt-1.5">
              {{ formatMoney(form.amount) }}
            </p>
          </AppCard>

          <p v-if="error" class="text-sm text-danger">{{ error }}</p>

          <div class="flex items-center gap-3">
            <AppButton type="submit" :loading="saving" :disabled="!isValid" :icon="icons.check">
              Saqlash
            </AppButton>
            <AppButton
              variant="outline"
              type="button"
              @click="router.push({ name: 'activity-detail', params: { id: activity.id } })"
            >
              Bekor qilish
            </AppButton>
          </div>
        </form>
      </template>
    </div>
  </AppLayout>
</template>
