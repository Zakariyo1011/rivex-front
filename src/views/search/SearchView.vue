<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import SearchUserResult from '@/components/search/SearchUserResult.vue'
import SearchActivityResult from '@/components/search/SearchActivityResult.vue'
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
import type { Activity, FollowRelationship, Region, User } from '@/types'
import { userProfileRoute } from '@/lib/userLink'

/**
 * Global search: activities and people.
 *
 * ## Two tabs, where there were four
 *
 * This screen used to offer `Hammasi | Odamlar | Faoliyatlar | Kategoriyalar`,
 * which was the API's shape showing through rather than the product's. "All"
 * was a combined preview nobody asks for, and a category is not a *result* — it
 * is a way to browse activities, which Explore already does. Four tabs at 375px
 * also left "Kategoriyalar" three characters wide.
 *
 * People open search with one of two things in mind: find an activity, or find
 * a person. Those are the tabs. Categories are still reachable from
 * autocomplete, where picking one deep-links into Explore filtered by it.
 *
 * ## One column, and why the layout was wrong before
 *
 * 🔴 The header, the field and the results were each given their own width and
 * alignment: the title sat hard against the left edge at `px-8` while the field
 * was a centred `max-w-2xl` card. They did not share an axis, so the title did
 * not look like it belonged to the thing underneath it, and the whole screen
 * read as parts assembled rather than a page. Everything now lives in one
 * centred column, so the eye follows a single edge from the title to the last
 * result.
 *
 * ## Sticky, but only where it earns its place
 *
 * On a phone the field stays reachable while results scroll, because re-finding
 * it would mean scrolling back. On desktop nothing sticks: there is no top
 * navigation to attach to, vertical space is not scarce, and a bar pinned to
 * the top of the window is exactly what made this screen look glued to the
 * chrome. The field also draws its separating border only once something has
 * scrolled behind it.
 *
 * ## Why the query lives in the URL
 *
 * `?q=` and `?type=` make a search shareable, bookmarkable and survivable
 * across a reload, and the back button then steps through searches the way
 * people expect.
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const recent = useRecentSearches()

const TABS: { value: SearchTypeKey; label: string; icon: typeof icons.profile }[] = [
  { value: 'activities', label: 'Faoliyatlar', icon: icons.date },
  { value: 'users', label: 'Odamlar', icon: icons.profile },
]

/** Activities first: it is what most people come to Rivex to find. */
const DEFAULT_TYPE: SearchTypeKey = 'activities'

function typeFromRoute(): SearchTypeKey {
  const value = route.query.type
  return value === 'users' || value === 'activities' ? value : DEFAULT_TYPE
}

const input = ref((route.query.q as string) ?? '')
const activeType = ref<SearchTypeKey>(typeFromRoute())
const page = ref(1)

const loading = ref(false)
/** A page-two fetch, which appends rather than replacing what is on screen. */
const loadingMore = ref(false)
const hasError = ref(false)
const searched = ref(false)

const users = ref<User[]>([])
const activities = ref<Activity[]>([])
const relationships = ref<Record<string, SearchRelationship>>({})
const total = ref(0)
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

/** Filters belong to activities; people have no date or price. */
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

function clearFilters() {
  applyFilters({
    ...filters,
    date: null,
    time_of_day: null,
    payment: null,
    people_needed: null,
    min_amount: null,
    max_amount: null,
    verified_only: false,
    region_id: null,
  })
}

// --- Derived state ----------------------------------------------------------

const trimmed = computed(() => input.value.trim())
const tooShort = computed(() => trimmed.value.length > 0 && trimmed.value.length < MIN_SEARCH_LENGTH)
const isEmpty = computed(() => trimmed.value.length === 0)

const results = computed(() => (activeType.value === 'users' ? users.value : activities.value))

const noResults = computed(
  () => searched.value && !loading.value && !hasError.value && results.value.length === 0,
)

const canLoadMore = computed(() => page.value < lastPage.value && !loading.value)

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

/**
 * Switching tab keeps the query.
 *
 * Typing a name, finding no activity by it and then having to retype it under
 * People is the single most annoying thing a two-tab search can do.
 */
watch(activeType, () => {
  page.value = 1
  resetResults()
  if (trimmed.value.length >= MIN_SEARCH_LENGTH) run()
  syncUrl()
})

// --- Loading ----------------------------------------------------------------

function resetResults() {
  users.value = []
  activities.value = []
  relationships.value = {}
  total.value = 0
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
    const { data } =
      activeType.value === 'users'
        ? await searchApi.users(q, page.value)
        : await searchApi.activities(q, page.value, activityFilterParams())

    if (mine !== token) return

    if (activeType.value === 'users') {
      const rows = data.data as User[]
      users.value = append ? [...users.value, ...rows] : rows
    } else {
      const rows = data.data as Activity[]
      activities.value = append ? [...activities.value, ...rows] : rows
    }

    relationships.value = append
      ? { ...relationships.value, ...data.relationships }
      : (data.relationships ?? {})

    total.value = data.meta.total
    lastPage.value = data.meta.last_page

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

/** The field and its dropdown, for the outside-click test below. */
const fieldRegion = ref<HTMLElement | null>(null)

/**
 * Close the suggestions when the press lands anywhere else.
 *
 * 🔴 Blur was the only thing that dismissed this panel, and clicking on the
 * page body does not blur an input — so the dropdown sat open on top of the
 * tabs and the first result, and the only ways out were to focus the field
 * again or to pick something.
 *
 * `mousedown` rather than `click`, so the panel is gone before the click
 * resolves on whatever is underneath it — otherwise dismissing costs two taps.
 */
function onDocumentPointerDown(event: MouseEvent) {
  if (!showSuggestions.value) return
  if (fieldRegion.value?.contains(event.target as Node)) return

  showSuggestions.value = false
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

  // A category is a way to browse activities rather than a result in its own
  // right, so choosing one hands over to Explore with that filter applied.
  router.push({ name: 'explore', query: { category_id: String(suggestion.id) } })
}

/**
 * Keep this screen's copy of a relationship in step with a follow from a row.
 *
 * The follow store is the source of truth and the row's button already reads
 * it; this only keeps the map behind the list consistent so a re-render — a new
 * page, a changed tab — does not paint a stale answer for a frame.
 */
function updateRelationship(userId: number, value: FollowRelationship) {
  relationships.value = { ...relationships.value, [String(userId)]: { ...value } }
}

// --- Screen chrome ----------------------------------------------------------

/**
 * Whether the reader has scrolled far enough for the sticky field to need
 * separating from the content moving under it.
 *
 * At rest the field is part of the page and draws no border, which is what
 * stops it reading as a navigation bar. It earns its border only once there is
 * something behind it to sit on top of.
 */
const scrolled = ref(false)

function onWindowScroll() {
  scrolled.value = window.scrollY > 8
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('scroll', onWindowScroll)
  document.removeEventListener('mousedown', onDocumentPointerDown)
})

/**
 * Leave the search screen.
 *
 * Back where there is somewhere to go back to, Home otherwise — a deep link
 * straight into `/search?q=` has no history entry behind it, and a back button
 * that does nothing is worse than no back button.
 */
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'home' })
}

// A query in the URL on arrival runs immediately — that is what makes a shared
// search link work.
if (trimmed.value.length >= MIN_SEARCH_LENGTH) run()
</script>

<template>
  <AppLayout>
    <!-- ONE COLUMN.
         The header, the field, the tabs and the results share a single centred
         column and a single left edge. They used to each have their own width
         and alignment, which is why the title did not look like it belonged to
         the field beneath it. -->
    <div class="pb-10 mx-auto w-full max-w-2xl desktop:max-w-3xl">
      <!-- Mobile screen header. Back first: this is a destination you arrive
           at from somewhere, and the way out has to be obvious. -->
      <div class="tablet:hidden flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          type="button"
          class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-ink-secondary hover:bg-surface-muted active:bg-surface-muted transition"
          aria-label="Orqaga"
          @click="goBack"
        >
          <FontAwesomeIcon :icon="icons.back" />
        </button>
        <h1 class="text-lg font-bold text-ink">Qidiruv</h1>
      </div>

      <!-- Desktop page header, in the same column as everything below it. -->
      <div class="hidden tablet:block px-8 pt-10 pb-5">
        <h1 class="text-3xl font-bold text-ink tracking-tight">Qidiruv</h1>
        <p class="text-sm text-ink-muted mt-1.5">
          Faoliyat yoki odam qidiring.
        </p>
      </div>

      <!-- The field and the tabs travel together: switching tab is part of
           searching, so it must stay reachable with the box on a phone.
           `tablet:static` makes this one element sticky on a phone and an
           ordinary block on a laptop, so there is one search box in the product
           rather than two that drift. -->
      <div
        class="sticky top-0 z-30 tablet:static bg-surface-muted px-4 tablet:px-8 pt-2 pb-2.5 tablet:pt-0 tablet:pb-0 transition-shadow"
        :class="scrolled ? 'shadow-[0_1px_0_0_var(--color-border)] tablet:shadow-none' : ''"
      >
        <div class="flex items-center gap-2.5">
          <div ref="fieldRegion" class="relative flex-1 min-w-0">
            <AppSearchInput
              v-model="input"
              placeholder="Faoliyat yoki odam qidiring..."
              @keyup.enter="submitNow"
              @keyup.escape="showSuggestions = false"
              @blur="dismissSuggestions"
            />

            <!-- Autocomplete. Anchored to the input and dismissed on choice, so
                 it never sits on top of the results it produced. -->
            <ul
              v-if="showSuggestions && suggestions.length"
              class="absolute z-40 inset-x-0 top-full mt-1.5 card p-1 max-h-80 overflow-y-auto shadow-lg"
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

        <!-- Two tabs, each half the width. They fit at 375px without scrolling
             or squeezing, which is the whole reason there are two of them. -->
        <div
          class="mt-3 grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface border border-border"
          role="tablist"
        >
          <button
            v-for="tab in TABS"
            :key="tab.value"
            type="button"
            role="tab"
            class="h-9 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            :class="
              activeType === tab.value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-ink-muted hover:bg-surface-muted'
            "
            :aria-selected="activeType === tab.value"
            @click="activeType = tab.value"
          >
            <FontAwesomeIcon :icon="tab.icon" class="text-xs" />
            {{ tab.label }}
            <span
              v-if="searched && activeType === tab.value && total > 0"
              class="text-[11px] tabular-nums text-white/80"
            >
              {{ total }}
            </span>
          </button>
        </div>
      </div>

      <div class="px-4 tablet:px-8 pt-5">
        <p v-if="tooShort" class="text-xs text-ink-faint mb-3">
          Kamida {{ MIN_SEARCH_LENGTH }} ta belgi kiriting.
        </p>

        <!-- Empty box: recent searches instead of a blank screen. -->
        <div v-if="isEmpty">
          <div v-if="recent.entries.value.length" class="mb-7">
            <div class="flex items-center justify-between mb-2.5">
              <h2 class="text-sm font-semibold text-ink">So'nggi qidiruvlar</h2>
              <button
                type="button"
                class="text-xs text-ink-faint hover:text-ink-muted"
                @click="recent.clear()"
              >
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
            description="Faoliyat nomi, joyi yoki odamning ismi va @nomi bo'yicha qidiring."
          />

          <!-- What each tab finds, said plainly. Search covers people as well
               as activities and nothing on the screen used to say so. -->
          <div class="mt-6 grid grid-cols-1 tablet:grid-cols-2 gap-2.5">
            <button
              v-for="hint in [
                {
                  type: 'activities' as SearchTypeKey,
                  icon: icons.date,
                  title: 'Faoliyatlar',
                  text: 'Nom, joy yoki tavsif bo‘yicha',
                },
                {
                  type: 'users' as SearchTypeKey,
                  icon: icons.profile,
                  title: 'Odamlar',
                  text: '@nom, ism, qiziqish yoki ko‘nikma',
                },
              ]"
              :key="hint.title"
              type="button"
              class="flex items-center gap-3 rounded-2xl bg-surface border border-border px-3.5 py-3 text-left hover:border-primary-300 transition"
              @click="activeType = hint.type"
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
            </button>
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
            :icon="activeType === 'users' ? icons.profile : icons.date"
            title="Hech narsa topilmadi"
            :description="`&quot;${trimmed}&quot; bo'yicha natija yo'q. Boshqa so'z bilan urinib ko'ring.`"
          />

          <div class="max-w-xs mx-auto -mt-2 space-y-2">
            <!-- When filters are on, they are the likeliest reason for an empty
                 list — say so and offer the way out. -->
            <template v-if="filtersApply && activeFilterCount">
              <p class="text-xs text-ink-muted text-center">
                {{ activeFilterCount }} ta filtr qo'llangan.
              </p>
              <AppButton variant="outline" @click="clearFilters">Filtrlarni tozalash</AppButton>
            </template>

            <!-- The other tab is the likeliest next move: somebody searching a
                 person's name under Activities finds nothing, and retyping it
                 is the most annoying thing a two-tab search can ask for. -->
            <AppButton
              v-else
              variant="outline"
              @click="activeType = activeType === 'users' ? 'activities' : 'users'"
            >
              {{ activeType === 'users' ? 'Faoliyatlar' : 'Odamlar' }} ichidan qidirish
            </AppButton>

            <AppButton variant="ghost" @click="clearAll">Qidiruvni tozalash</AppButton>
          </div>
        </div>

        <div v-else-if="searched">
          <ul class="space-y-2">
            <template v-if="activeType === 'users'">
              <SearchUserResult
                v-for="user in users"
                :key="user.id"
                :user="user"
                :relationship="relationships[String(user.id)]"
                :viewer-id="auth.user?.id ?? null"
                @update:relationship="(r) => updateRelationship(user.id, r)"
              />
            </template>
            <template v-else>
              <SearchActivityResult
                v-for="activity in activities"
                :key="activity.id"
                :activity="activity"
              />
            </template>
          </ul>

          <!-- Appends rather than replacing: a page-number control is a poor
               target on a phone, and losing your place is worse than a long
               list. -->
          <AppButton
            v-if="canLoadMore"
            variant="outline"
            class="mt-4"
            :loading="loadingMore"
            @click="loadMore"
          >
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
