<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchUserResult from '@/components/search/SearchUserResult.vue'
import SearchActivityResult from '@/components/search/SearchActivityResult.vue'
import SearchCategoryResult from '@/components/search/SearchCategoryResult.vue'
import { searchApi, MIN_SEARCH_LENGTH, type SearchRelationship, type SearchTypeKey, type Suggestion } from '@/api/search'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { Activity, Category, FollowRelationship, User } from '@/types'
import { userProfileRoute } from '@/lib/userLink'

/**
 * Global search.
 *
 * One box over people, activities and the category tree. Distinct from Explore,
 * which browses activities with filters — this is for when somebody knows
 * roughly what they are looking for and does not want to pick a screen first.
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

const TYPES: { value: SearchTypeKey; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'users', label: 'Odamlar' },
  { value: 'activities', label: 'Faoliyatlar' },
  { value: 'categories', label: 'Kategoriyalar' },
]

const input = ref((route.query.q as string) ?? '')
const activeType = ref<SearchTypeKey>((route.query.type as SearchTypeKey) ?? 'all')
const page = ref(1)

const loading = ref(false)
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

const trimmed = computed(() => input.value.trim())
const tooShort = computed(() => trimmed.value.length > 0 && trimmed.value.length < MIN_SEARCH_LENGTH)
const isEmpty = computed(() => trimmed.value.length === 0)

const tabs = computed(() =>
  TYPES.map((type) => {
    const count = counts.value[type.value]
    return {
      value: type.value,
      label: type.value !== 'all' && count ? `${type.label} (${count})` : type.label,
    }
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

async function run() {
  const q = trimmed.value
  if (q.length < MIN_SEARCH_LENGTH) return

  const mine = ++token
  loading.value = true
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
      resetResults()

      const { data } =
        activeType.value === 'users'
          ? await searchApi.users(q, page.value)
          : activeType.value === 'activities'
            ? await searchApi.activities(q, page.value)
            : await searchApi.categories(q, page.value)

      if (mine !== token) return

      if (activeType.value === 'users') users.value = data.data as User[]
      if (activeType.value === 'activities') activities.value = data.data as Activity[]
      if (activeType.value === 'categories') categories.value = data.data as Category[]

      relationships.value = data.relationships ?? {}
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
    if (mine === token) loading.value = false
  }
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

function goToPage(next: number) {
  page.value = next
  run()
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

const showUsers = computed(() => activeType.value === 'all' || activeType.value === 'users')
const showActivities = computed(() => activeType.value === 'all' || activeType.value === 'activities')
const showCategories = computed(() => activeType.value === 'all' || activeType.value === 'categories')

// A query in the URL on arrival runs immediately — that is what makes a shared
// search link work.
if (trimmed.value.length >= MIN_SEARCH_LENGTH) run()
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Qidiruv</h1>
    </template>

    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl pb-10">
      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-4">Qidiruv</h1>

      <div class="relative">
        <AppSearchInput
          v-model="input"
          placeholder="Odam, faoliyat yoki kategoriya..."
          @keyup.enter="submitNow"
          @keyup.escape="showSuggestions = false"
          @blur="dismissSuggestions"
        />

        <!-- Autocomplete. Anchored to the input and dismissed on choice, so it
             never sits on top of the results it produced. -->
        <ul
          v-if="showSuggestions && suggestions.length"
          class="absolute z-30 inset-x-0 top-full mt-1 card p-1 max-h-80 overflow-y-auto shadow-lg"
        >
          <li v-for="s in suggestions" :key="`${s.type}-${s.id}`">
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-muted flex items-center gap-2"
              @click="pickSuggestion(s)"
            >
              <FontAwesomeIcon
                :icon="s.type === 'users' ? icons.profile : s.type === 'activities' ? icons.time : icons.explore"
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

      <p v-if="tooShort" class="text-xs text-ink-faint mt-2">
        Kamida {{ MIN_SEARCH_LENGTH }} ta belgi kiriting.
      </p>

      <AppTabs
        v-if="!isEmpty"
        :model-value="activeType"
        :tabs="tabs"
        class="mt-4"
        @update:model-value="(v) => (activeType = v as SearchTypeKey)"
      />

      <!-- Empty box: recent searches instead of a blank screen. -->
      <div v-if="isEmpty" class="mt-6">
        <div v-if="recent.entries.value.length">
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
              class="px-3 h-8 rounded-full border border-border text-sm text-ink-secondary hover:border-primary-300"
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
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="mt-4 space-y-2">
        <div v-for="i in 5" :key="i" class="card p-3 flex items-center gap-3">
          <Skeleton variant="circle" />
          <div class="flex-1 space-y-2">
            <Skeleton variant="text" width="45%" />
            <Skeleton variant="text" width="25%" />
          </div>
        </div>
      </div>

      <ErrorState v-else-if="hasError" class="mt-4" @retry="run" />

      <EmptyState
        v-else-if="noResults"
        class="mt-4"
        :icon="icons.explore"
        title="Hech narsa topilmadi"
        :description="`&quot;${trimmed}&quot; bo'yicha natija yo'q. Boshqa so'z bilan urinib ko'ring.`"
      />

      <div v-else-if="searched" class="mt-4 space-y-6">
        <section v-if="showUsers && users.length">
          <h2 v-if="activeType === 'all'" class="text-sm font-semibold text-ink mb-2">Odamlar</h2>
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
          <h2 v-if="activeType === 'all'" class="text-sm font-semibold text-ink mb-2">
            Faoliyatlar
          </h2>
          <ul class="space-y-2">
            <SearchActivityResult
              v-for="activity in activities"
              :key="activity.id"
              :activity="activity"
            />
          </ul>
        </section>

        <section v-if="showCategories && categories.length">
          <h2 v-if="activeType === 'all'" class="text-sm font-semibold text-ink mb-2">
            Kategoriyalar
          </h2>
          <ul class="space-y-2">
            <SearchCategoryResult
              v-for="category in categories"
              :key="category.id"
              :category="category"
            />
          </ul>
        </section>

        <Pagination
          v-if="activeType !== 'all' && lastPage > 1"
          :current-page="page"
          :last-page="lastPage"
          @update:current-page="goToPage"
        />
      </div>
    </div>
  </AppLayout>
</template>
