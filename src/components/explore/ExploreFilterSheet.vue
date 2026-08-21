<script setup lang="ts">
import { reactive, watch } from 'vue'
import AppDrawer from '@/components/ui/AppDrawer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import AppInput from '@/components/ui/AppInput.vue'
import type { ActivitySort, TimeOfDay } from '@/api/activities'
import type { Region } from '@/types'

export interface ExploreFilters {
  date: 'today' | 'tomorrow' | 'week' | null
  time_of_day: TimeOfDay | null
  payment: 'free' | 'paid' | null
  people_needed: number | null
  min_amount: number | null
  max_amount: number | null
  verified_only: boolean
  region_id: number | null
  sort: ActivitySort
}

const props = withDefaults(
  defineProps<{
    filters: ExploreFilters
    regions: Region[]
    /**
     * Whether to offer the sort control.
     *
     * Explore sorts by whatever is asked for. Search sorts by relevance, and
     * the search endpoint deliberately does not accept a sort — offering the
     * control there would be a row of buttons that changed nothing, which is
     * worse than not having it.
     */
    showSort?: boolean
  }>(),
  { showSort: true },
)

/**
 * `apply` hands back a plain snapshot and the parent MERGES it into its own
 * reactive object. Deliberately not `v-model`: that would reassign the
 * parent's `reactive()` object, replacing the proxy its computeds are tracking
 * — the request would carry the new filters while the badge silently kept
 * showing the old count.
 */
const emit = defineEmits<{
  close: []
  apply: [value: ExploreFilters]
}>()

// Edited on a copy so closing the sheet without applying changes nothing.
const draft = reactive<ExploreFilters>({ ...props.filters })

watch(
  () => ({ ...props.filters }),
  (next) => Object.assign(draft, next),
)

const dates: { value: ExploreFilters['date']; label: string }[] = [
  { value: null, label: 'Istalgan kun' },
  { value: 'today', label: 'Bugun' },
  { value: 'tomorrow', label: 'Ertaga' },
]

const times: { value: TimeOfDay | null; label: string }[] = [
  { value: null, label: 'Istalgan vaqt' },
  { value: 'morning', label: 'Ertalab' },
  { value: 'afternoon', label: 'Kunduzi' },
  { value: 'evening', label: 'Kechqurun' },
  { value: 'night', label: 'Tunda' },
]

const payments: { value: ExploreFilters['payment']; label: string }[] = [
  { value: null, label: 'Hammasi' },
  { value: 'free', label: 'Bepul' },
  { value: 'paid', label: 'Pullik' },
]

const groupSizes: { value: number | null; label: string }[] = [
  { value: null, label: 'Farqi yo\'q' },
  { value: 1, label: '1 kishi' },
  { value: 2, label: '2 kishi' },
  { value: 3, label: '3+ kishi' },
]

// `recommended` is deliberately missing: personalised ranking lands in a later
// phase, and offering it now would be a sort option that does not rank.
const sorts: { value: ActivitySort; label: string }[] = [
  { value: 'newest', label: 'Yangi' },
  { value: 'starting_soon', label: 'Tez boshlanadi' },
  { value: 'popular', label: 'Ommabop' },
  { value: 'nearest', label: 'Eng yaqin' },
  { value: 'price_low', label: 'Arzon' },
  { value: 'price_high', label: 'Qimmat' },
]

function apply() {
  emit('apply', { ...draft })
  emit('close')
}

function reset() {
  Object.assign(draft, {
    date: null,
    time_of_day: null,
    payment: null,
    people_needed: null,
    min_amount: null,
    max_amount: null,
    verified_only: false,
    region_id: null,
    sort: 'newest' as ActivitySort,
  })
}
</script>

<template>
  <AppDrawer title="Filtrlar" @close="emit('close')">
    <div class="space-y-6">
      <section>
        <p class="text-sm font-semibold text-ink mb-2.5">Qachon</p>
        <div class="flex flex-wrap gap-2">
          <FilterChip
            v-for="option in dates"
            :key="String(option.value)"
            :active="draft.date === option.value"
            @click="draft.date = option.value"
          >
            {{ option.label }}
          </FilterChip>
        </div>
      </section>

      <section>
        <p class="text-sm font-semibold text-ink mb-2.5">Kun vaqti</p>
        <div class="flex flex-wrap gap-2">
          <FilterChip
            v-for="option in times"
            :key="String(option.value)"
            :active="draft.time_of_day === option.value"
            @click="draft.time_of_day = option.value"
          >
            {{ option.label }}
          </FilterChip>
        </div>
      </section>

      <section>
        <p class="text-sm font-semibold text-ink mb-2.5">To'lov</p>
        <div class="flex flex-wrap gap-2">
          <FilterChip
            v-for="option in payments"
            :key="String(option.value)"
            :active="draft.payment === option.value"
            @click="draft.payment = option.value"
          >
            {{ option.label }}
          </FilterChip>
        </div>
      </section>

      <section v-if="draft.payment !== 'free'">
        <p class="text-sm font-semibold text-ink mb-2.5">Narx (UZS)</p>
        <div class="grid grid-cols-2 gap-3">
          <AppInput
            :model-value="draft.min_amount ?? ''"
            type="number"
            placeholder="Eng kam"
            @update:model-value="draft.min_amount = $event === '' ? null : Number($event)"
          />
          <AppInput
            :model-value="draft.max_amount ?? ''"
            type="number"
            placeholder="Eng ko'p"
            @update:model-value="draft.max_amount = $event === '' ? null : Number($event)"
          />
        </div>
      </section>

      <section>
        <p class="text-sm font-semibold text-ink mb-2.5">Nechta kishi kerak</p>
        <div class="flex flex-wrap gap-2">
          <FilterChip
            v-for="option in groupSizes"
            :key="String(option.value)"
            :active="draft.people_needed === option.value"
            @click="draft.people_needed = option.value"
          >
            {{ option.label }}
          </FilterChip>
        </div>
      </section>

      <section>
        <AppSelect
          :model-value="draft.region_id"
          label="Viloyat"
          placeholder="Barcha viloyatlar"
          numeric
          :options="regions.map((r) => ({ value: r.id, label: r.name }))"
          @update:model-value="draft.region_id = $event as number | null"
        />
      </section>

      <section>
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span>
            <span class="block text-sm font-semibold text-ink">Faqat tasdiqlangan tashkilotchilar</span>
            <span class="block text-xs text-ink-muted mt-0.5">Shaxsi tasdiqlangan foydalanuvchilar</span>
          </span>
          <input v-model="draft.verified_only" type="checkbox" class="w-5 h-5 accent-primary-600 shrink-0" />
        </label>
      </section>

      <section v-if="showSort">
        <p class="text-sm font-semibold text-ink mb-2.5">Saralash</p>
        <div class="flex flex-wrap gap-2">
          <FilterChip
            v-for="option in sorts"
            :key="option.value"
            :active="draft.sort === option.value"
            @click="draft.sort = option.value"
          >
            {{ option.label }}
          </FilterChip>
        </div>
      </section>

      <div class="flex gap-3 pt-2 sticky bottom-0 bg-surface pb-1">
        <AppButton variant="outline" @click="reset">Tozalash</AppButton>
        <AppButton @click="apply">Qo'llash</AppButton>
      </div>
    </div>
  </AppDrawer>
</template>
