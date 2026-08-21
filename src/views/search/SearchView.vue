<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import SearchUserResult from '@/components/search/SearchUserResult.vue'
import SearchActivityResult from '@/components/search/SearchActivityResult.vue'
import SearchCategoryResult from '@/components/search/SearchCategoryResult.vue'
import ExploreFilterSheet, { type ExploreFilters } from '@/components/explore/ExploreFilterSheet.vue'
import {
  searchApi,
  MIN_SEARCH_LENGTH,
  type SearchRelationship,
  type SearchTypeKey,
  type Suggestion,
} from '@/api/search'
import type { ActivityFilters } from '@/api/activities'
import { locationsApi } from '@/api/locations'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { Activity, Category, FollowRelationship, Region, User } from '@/types'
import { userProfileRoute } from '@/lib/userLink'

/**
 * Global search.
 *
 * One box over people, activities and the category tree. Distinct from Explore,
 * which browses activities with filters — this is for when somebody knows
 * roughly what they are looking for and does not want to pick a screen first.
 *
 * ## This screen was unreachable on a phone
 *
 * 🔴 It is the only way to find a *person* in Rivex, and mobile had no route to
 * it: the bottom bar gave up its search slot on the stated grounds that Home
 * carries a search field, and Home's field routed to Explore, which browses
 * activities. So the screen existed, worked, and could not be opened. Two entry
 * points now lead here — Home's field and a button in `AppLayout`'s mobile
 * header — and both go to this one route rather than to a mobile variant.
 *
 * ## Mobile is the layout, not a reduced version
 *
 * The header is sticky and holds the input, so the box stays reachable while
 * results scroll. Tabs scroll horizontally rather than shrinking to four
 * unreadable thirds at 375px. Paging is a "load more" that appends, because a
 * page-number control is a poor target on a phone and losing your place is
 * worse than a longer list. Nothing is hidden here that desktop has — including
 * the filters, which are the same sheet Explore uses and the same rules
 * server-side.
 *
 * ## Why the query lives in the URL
 *
 * `?q=` and `?type=` make a search shareable, bookmarkable and survivable across
 * a reload, and the browser's back button then steps through searches the way
 * people expect. It also means the deep link from an autocomplete suggestion and
 * a typed query end up in exactly the same state.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const recent = useRecentSearches()

const TYPES: { value: SearchTypeKey; label: string; icon: typeof icons.profile }[] = [
  { value: 'all', label: 'Hammasi', icon: icons.explore },
  { value: 'users', label: 'Odamlar', icon: icons.profile },
  { value: 'activities', label: 'Faoliyatlar', icon: icons.date },
  { value: 'categories', label: 'Kategoriyalar', icon: icons.category },
]

const input = ref((route.query.q as string) ?? '')
const activeType = ref<SearchTypeKey>((route.query.type as SearchTypeKey) ?? 'all')
const page = ref(1)

const loading = ref(false)
/** A page-two fetch, which appends rather than replacing what is on screen. */
const loadingMore = ref(false)
const hasError = ref(false)
const searched = ref(false)

const users = ref<User[]>([])
const activities = ref<Activity[]>([])
const categories = ref<Category[]>([])
const relationships = ref<Record<string, SearchRelationship>>({})
const counts = ref<Record<string, number>>({})
const lastPage = ref(1)

const suggestions = ref<Suggestion[]>([])
const showSuggestions = ref(false)

// --- Filters ----------------------------------------------------------------

const showFilters = ref(false)
const regions = ref<Region[]>([])
let regionsRequested = false

const filters = reactive<ExploreFilters>({
  date: null,
  time_of_day: null,
  payment: null,
  people_needed: null,
  min_amount: null,
  max_amount: null,
  verified_only: false,
  region_id: null,
  // Present because the sheet's type requires it; the sheet does not offer the
  // control here and the endpoint does not accept it — search ranks by
  // relevance. See ExploreFilterSheet's `showSort`.
  sort: 'newest',
})

const activeFilterCount = computed(() => {
  let count = 0
  if (filters.date) count++
  if (filters.time_of_day) count++
  if (filters.payment) count++
  if (filters.people_needed) count++
  if (filters.min_amount !== null || filters.max_amount !== null) count++
  if (filters.verified_only) count++
  if (filters.region_id) count++
  return count
})

/** Filters belong to activities; people and categories have no date or price. */
const filtersApply = computed(() => activeType.value === 'activities')

function activityFilterParams(): ActivityFilters {
  return {
    date: filters.date ?? undefined,
    time_of_day: filters.time_of_day ?? undefined,
    payment: filters.payment ?? undefined,
    people_needed: filters.people_needed ?? undefined,
    min_amount: filters.min_amount ?? undefined,
    max_amount: filters.max_amount ?? undefined,
    verified_only: filters.verified_only || undefined,
    region_id: filters.region_id ?? undefined,
  }
}

async function openFilters() {
  showFilters.value = true

  // Fetched the first time the sheet is opened, not on page load: most searches
  // never touch it, and the region list is the only thing it needs.
  if (regionsRequested) return
  regionsRequested = true

  try {
    const { data } = await locationsApi.regions()
    regions.value = data.data
  } catch {
    // The sheet still works; the region select is simply empty.
  }
}

function applyFilters(next: ExploreFilters) {
  Object.assign(filters, next)
  page.value = 1
  run()
}

// --- Derived state ----------------------------------------------------------

const trimmed = computed(() => input.value.trim())
const tooShort = computed(() => trimmed.value.length > 0 && trimmed.value.length < MIN_SEARCH_LENGTH)
const isEmpty = computed(() => trimmed.value.length === 0)

const tabs = computed(() =>
  TYPES.map((type) => {
    const count = counts.value[type.value]

    return { ...type, count: type.value === 'all' ? null : (count ?? null) }
  }),
)

const noResults = computed(
  () =>
    searched.value &&
    !loading.value &&
    !hasError.value &&
    users.value.length === 0 &&
    activities.value.length === 0 &&
    categories.value.length === 0,
)

const canLoadMore = computed(
  () => activeType.value !== 'all' && page.value < lastPage.value && !loading.value,
)

const showUsers = computed(() => activeType.value === 'all' || activeType.value === 'users')
const showActivities = computed(() => activeType.value === 'all' || activeType.value === 'activities')
const showCategories = computed(() => activeType.value === 'all' || activeType.value === 'categories')

// --- Debounce ---------------------------------------------------------------

let searchTimer: ReturnType<typeof setTimeout> | undefined
let suggestTimer: ReturnType<typeof setTimeout> | undefined
/**
 * Guards against an earlier, slower response overwriting a later one — the same
 * token pattern the handle checker uses. Without it, typing quickly on a poor
 * connection shows results for a query the user has already moved past.
 */
let token = 0
/**
 * Suggestions carry their own token.
 *
 * Sharing the search counter meant `run()` incrementing it invalidated a
 * suggestion request that was still in flight, so the dropdown never appeared —
 * the two are independent requests and one must not cancel the other.
 */
let suggestToken = 0

function clearTimers() {
  clearTimeout(searchTimer)
  clearTimeout(suggestTimer)
}

onBeforeUnmount(clearTimers)

watch(input, (value) => {
  clearTimers()
  hasError.value = false

  if (value.trim().length < MIN_SEARCH_LENGTH) {
    // Below the floor the server applies, so nothing is sent at all.
    suggestions.value = []
    showSuggestions.value = false
    resetResults()
    searched.value = false
    return
  }

  suggestTimer = setTimeout(loadSuggestions, 200)
  searchTimer = setTimeout(() => {
    page.value = 1
    run()
  }, 350)
})

watch(activeType, () => {
  page.value = 1
  if (trimmed.value.length >= MIN_SEARCH_LENGTH) run()
  syncUrl()
})

// --- Loading ----------------------------------------------------------------

function resetResults() {
  users.value = []
  activities.value = []
  categories.value = []
  relationships.value = {}
  counts.value = {}
  lastPage.value = 1
}

async function loadSuggestions() {
  const mine = ++suggestToken
  try {
    const { data } = await searchApi.suggest(trimmed.value)
    if (mine !== suggestToken) return
    suggestions.value = data.suggestions
    showSuggestions.value = data.suggestions.length > 0
  } catch {
    // A failed suggestion is not worth telling anybody about; the search
    // underneath it still works.
    suggestions.value = []
  }
}

/**
 * @param append page two and beyond keep what is already on screen. Replacing
 *   it would throw away the reader's place, which on a phone means scrolling
 *   back through everything they had already dismissed.
 */
async function run(append = false) {
  const q = trimmed.value
  if (q.length < MIN_SEARCH_LENGTH) return

  const mine = ++token

  if (append) loadingMore.value = true
  else loading.value = true

  hasError.value = false

  try {
    if (activeType.value === 'all') {
      const { data } = await searchApi.overview(q)
      if (mine !== token) return

      users.value = data.results.users.data
      activities.value = data.results.activities.data
      categories.value = data.results.categories.data
      relationships.value = data.relationships ?? {}
      counts.value = data.meta.counts
      lastPage.value = 1
    } else {
      if (!append) resetResults()

      const { data } =
        activeType.value === 'users'
          ? await searchApi.users(q, page.value)
          : activeType.value === 'activities'
            ? await searchApi.activities(q, page.value, activityFilterParams())
            : await searchApi.categories(q, page.value)

      if (mine !== token) return

      if (activeType.value === 'users') {
        users.value = append ? [...users.value, ...(data.data as User[])] : (data.data as User[])
      }
      if (activeType.value === 'activities') {
        activities.value = append
          ? [...activities.value, ...(data.data as Activity[])]
          : (data.data as Activity[])
      }
      if (activeType.value === 'categories') {
        categories.value = append
          ? [...categories.value, ...(data.data as Category[])]
          : (data.data as Category[])
      }

      relationships.value = append
        ? { ...relationships.value, ...data.relationships }
        : (data.relationships ?? {})
      counts.value = { ...counts.value, [activeType.value]: data.meta.total }
      lastPage.value = data.meta.last_page
    }

    searched.value = true
    recent.remember(q)
    syncUrl()
  } catch {
    if (mine !== token) return
    hasError.value = true
  } finally {
    if (mine === token) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function loadMore() {
  if (!canLoadMore.value) return
  page.value += 1
  run(true)
}

function syncUrl() {
  router.replace({
    name: 'search',
    query: trimmed.value ? { q: trimmed.value, type: activeType.value } : {},
  })
}

function submitNow() {
  clearTimers()
  showSuggestions.value = false
  page.value = 1
  run()
}

function clearAll() {
  input.value = ''
  Object.assign(filters, {
    date: null,
    time_of_day: null,
    payment: null,
    people_needed: null,
    min_amount: null,
    max_amount: null,
    verified_only: false,
    region_id: null,
    sort: 'newest',
  })
  resetResults()
  searched.value = false
  syncUrl()
}

/**
 * Dismiss on blur, one tick late.
 *
 * A click on a suggestion blurs the input before the click lands, so hiding
 * immediately would swallow every selection.
 */
function dismissSuggestions() {
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

function pickRecent(term: string) {
  input.value = term
}

function pickSuggestion(suggestion: Suggestion) {
  showSuggestions.value = false

  if (suggestion.type === 'users') {
    const target = userProfileRoute({ id: suggestion.id, username: suggestion.username })
    if (target) router.push(target)

    return
  }

  if (suggestion.type === 'activities') {
    router.push({ name: 'activity-detail', params: { id: String(suggestion.id) } })
    return
  }

  router.push({ name: 'explore', query: { category_id: String(suggestion.id) } })
}

function updateRelationship(userId: number, value: FollowRelationship) {
  relationships.value = {
    ...relationships.value,
    [String(userId)]: {
      is_following: value.is_following,
      follow_status: value.follow_status,
      is_followed_by: value.is_followed_by,
    },
  }
}

// A query in the URL on arrival runs immediately — that is what makes a shared
// search link work.
if (trimmed.value.length >= MIN_SEARCH_LENGTH) run()
</script>

<template>
  <AppLayout>
    <div class="pb-10">
      <!-- Sticky search bar. It owns the top of the screen rather than sitting
           under AppLayout's header row, because on a phone the box has to stay
           reachable while the results scroll under it. -->
      <div
        class="sticky top-0 z-30 bg-surface-muted/95 backdrop-blur border-b border-border/60 px-4 md:px-8 pt-3 pb-2.5"
      >
        <h1 class="hidden tablet:block text-xl font-bold text-ink mb-3">Qidiruv</h1>

        <div class="flex items-center gap-2.5 max-w-2xl">
          <div class="relative flex-1 min-w-0">
            <AppSearchInput
              v-model="input"
              placeholder="Odam, faoliyat yoki kategoriya..."
              @keyup.enter="submitNow"
              @keyup.escape="showSuggestions = false"
              @blur="dismissSuggestions"
            />

            <!-- Autocomplete. Anchored to the input and dismissed on choice, so
                 it never sits on top of the results it produced. -->
            <ul
              v-if="showSuggestions && suggestions.length"
              class="absolute z-30 inset-x-0 top-full mt-1 card p-1 max-h-80 overflow-y-auto shadow-lg"
            >
              <li v-for="s in suggestions" :key="`${s.type}-${s.id}`">
                <button
                  type="button"
                  class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-muted flex items-center gap-2"
                  @click="pickSuggestion(s)"
                >
                  <FontAwesomeIcon
                    :icon="
                      s.type === 'users'
                        ? icons.profile
                        : s.type === 'activities'
                          ? icons.date
                          : icons.category
                    "
                    class="text-ink-faint text-xs shrink-0"
                  />
                  <span class="text-sm text-ink truncate">{{ s.label }}</span>
                  <span v-if="s.sublabel" class="text-xs text-ink-faint truncate ml-auto">
                    {{ s.sublabel }}
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <!-- Filters, on the tab they belong to. The same sheet Explore opens
               and the same rules server-side — a results page with no filters
               beside a browse page with eight is why people started over. -->
          <button
            v-if="filtersApply"
            type="button"
            class="relative shrink-0 h-12 w-12 rounded-xl border border-border bg-surface text-ink-muted flex items-center justify-center hover:border-primary-300 hover:text-primary-600 transition"
            aria-label="Filtrlar"
            @click="openFilters"
          >
            <FontAwesomeIcon :icon="icons.filter" />
            <span
              v-if="activeFilterCount"
              class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {{ activeFilterCount }}
            </span>
          </button>
        </div>

        <!-- Scrolls rather than squeezing. Four equal tabs at 375px leaves
             "Kategoriyalar" three characters wide. -->
        <div
          v-if="!isEmpty"
          class="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mt-2.5 pb-0.5 max-w-2xl"
        >
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="shrink-0 h-9 px-3.5 rounded-full text-sm font-medium transition flex items-center gap-1.5"
            :class="
              activeType === tab.value
                ? 'bg-primary-600 text-white'
                : 'bg-surface text-ink-muted border border-border hover:border-primary-300'
            "
            :aria-pressed="activeType === tab.value"
            @click="activeType = tab.value"
          >
            <FontAwesomeIcon :icon="tab.icon" class="text-[11px]" />
            {{ tab.label }}
            <span
              v-if="tab.count"
              class="text-[11px] tabular-nums"
              :class="activeType === tab.value ? 'text-white/80' : 'text-ink-faint'"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>

      <div class="px-4 md:px-8 pt-4 max-w-2xl">
        <p v-if="tooShort" class="text-xs text-ink-faint mb-3">
          Kamida {{ MIN_SEARCH_LENGTH }} ta belgi kiriting.
        </p>

        <!-- Empty box: recent searches instead of a blank screen. -->
        <div v-if="isEmpty">
          <div v-if="recent.entries.value.length" class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold text-ink">So'nggi qidiruvlar</h2>
              <button type="button" class="text-xs text-ink-faint" @click="recent.clear()">
                Tozalash
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="term in recent.entries.value"
                :key="term"
                type="button"
                class="px-3.5 h-9 rounded-full border border-border bg-surface text-sm text-ink-secondary hover:border-primary-300"
                @click="pickRecent(term)"
              >
                {{ term }}
              </button>
            </div>
          </div>

          <EmptyState
            v-else
            :icon="icons.explore"
            title="Nimani qidiryapsiz?"
            description="Odamlar, faoliyatlar va kategoriyalar bo'yicha qidiring."
          />

          <!-- What this box can find, said plainly. Search covers people as
               well as activities and nothing on the screen used to say so. -->
          <div class="mt-6 grid grid-cols-1 gap-2">
            <div
              v-for="hint in [
                { icon: icons.profile, title: 'Odamlar', text: '@nom, ism, qiziqish yoki ko‘nikma' },
                { icon: icons.date, title: 'Faoliyatlar', text: 'Nom, joy yoki tavsif bo‘yicha' },
                { icon: icons.category, title: 'Kategoriyalar', text: 'Masalan: gaming, sport, kino' },
              ]"
              :key="hint.title"
              class="flex items-center gap-3 rounded-xl bg-surface border border-border px-3.5 py-3"
            >
              <span
                class="w-9 h-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"
              >
                <FontAwesomeIcon :icon="hint.icon" class="text-sm" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">{{ hint.title }}</p>
                <p class="text-xs text-ink-muted truncate">{{ hint.text }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-else-if="loading" class="space-y-2">
          <div v-for="i in 5" :key="i" class="card p-3 flex items-center gap-3">
            <Skeleton variant="circle" />
            <div class="flex-1 space-y-2">
              <Skeleton variant="text" width="45%" />
              <Skeleton variant="text" width="25%" />
            </div>
          </div>
        </div>

        <ErrorState v-else-if="hasError" @retry="run()" />

        <div v-else-if="noResults">
          <EmptyState
            :icon="icons.explore"
            title="Hech narsa topilmadi"
            :description="`&quot;${trimmed}&quot; bo'yicha natija yo'q. Boshqa so'z bilan urinib ko'ring.`"
          />

          <!-- When filters are on, they are the likeliest reason for an empty
               list — say so and offer the way out. -->
          <div v-if="filtersApply && activeFilterCount" class="max-w-xs mx-auto -mt-2 space-y-2">
            <p class="text-xs text-ink-muted text-center">
              {{ activeFilterCount }} ta filtr qo'llangan.
            </p>
            <AppButton variant="outline" @click="applyFilters({ ...filters, date: null, time_of_day: null, payment: null, people_needed: null, min_amount: null, max_amount: null, verified_only: false, region_id: null })">
              Filtrlarni tozalash
            </AppButton>
          </div>
          <div v-else-if="!isEmpty" class="max-w-xs mx-auto -mt-2">
            <AppButton variant="outline" @click="clearAll">Qidiruvni tozalash</AppButton>
          </div>
        </div>

        <div v-else-if="searched" class="space-y-6">
          <section v-if="showUsers && users.length">
            <div v-if="activeType === 'all'" class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold text-ink">Odamlar</h2>
              <button
                v-if="(counts.users ?? 0) > users.length"
                type="button"
                class="text-xs font-medium text-primary-600"
                @click="activeType = 'users'"
              >
                Barchasi ({{ counts.users }})
              </button>
            </div>
            <ul class="space-y-2">
              <SearchUserResult
                v-for="user in users"
                :key="user.id"
                :user="user"
                :relationship="relationships[String(user.id)]"
                :viewer-id="auth.user?.id ?? null"
                @update:relationship="(r) => updateRelationship(user.id, r)"
              />
            </ul>
          </section>

          <section v-if="showActivities && activities.length">
            <div v-if="activeType === 'all'" class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold text-ink">Faoliyatlar</h2>
              <button
                v-if="(counts.activities ?? 0) > activities.length"
                type="button"
                class="text-xs font-medium text-primary-600"
                @click="activeType = 'activities'"
              >
                Barchasi ({{ counts.activities }})
              </button>
            </div>
            <ul class="space-y-2">
              <SearchActivityResult
                v-for="activity in activities"
                :key="activity.id"
                :activity="activity"
              />
            </ul>
          </section>

          <section v-if="showCategories && categories.length">
            <div v-if="activeType === 'all'" class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold text-ink">Kategoriyalar</h2>
              <button
                v-if="(counts.categories ?? 0) > categories.length"
                type="button"
                class="text-xs font-medium text-primary-600"
                @click="activeType = 'categories'"
              >
                Barchasi ({{ counts.categories }})
              </button>
            </div>
            <ul class="space-y-2">
              <SearchCategoryResult
                v-for="category in categories"
                :key="category.id"
                :category="category"
              />
            </ul>
          </section>

          <!-- Appends rather than replacing: a page-number control is a poor
               target on a phone, and losing your place is worse than a long
               list. -->
          <AppButton v-if="canLoadMore" variant="outline" :loading="loadingMore" @click="loadMore">
            Ko'proq yuklash
          </AppButton>
        </div>
      </div>
    </div>

    <ExploreFilterSheet
      v-if="showFilters"
      :filters="filters"
      :regions="regions"
      :show-sort="false"
      @close="showFilters = false"
      @apply="applyFilters"
    />
  </AppLayout>
</template>
