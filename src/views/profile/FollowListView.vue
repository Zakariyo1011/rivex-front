<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isAxiosError } from 'axios'
import AppLayout from '@/layouts/AppLayout.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import Avatar from '@/components/ui/Avatar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Pagination from '@/components/ui/Pagination.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import FollowButton from '@/components/profile/FollowButton.vue'
import { followsApi, type FollowListUser } from '@/api/follows'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { FollowRelationship } from '@/types'
import { userProfileRoute } from '@/lib/userLink'

/**
 * Followers and following for one account, plus the owner's own request inbox.
 *
 * One screen for all three because they are the same list of people with a
 * different source — three near-identical components would drift in exactly the
 * places that matter (the empty state, the privacy error, the pagination).
 */
const route = useRoute()
const auth = useAuthStore()

type Tab = 'followers' | 'following' | 'requests'

const userId = computed(() => Number(route.params.id))
const isOwner = computed(() => auth.user?.id === userId.value)

const tab = ref<Tab>((route.params.tab as Tab) ?? 'followers')
const people = ref<FollowListUser[]>([])
const page = ref(1)
const lastPage = ref(1)
const loading = ref(true)
const hasError = ref(false)
/** The account exists but will not show this list to this viewer. */
const forbidden = ref(false)
const notFound = ref(false)

const tabs = computed(() => {
  const base = [
    { value: 'followers', label: 'Kuzatuvchilar' },
    { value: 'following', label: 'Kuzatilmoqda' },
  ]

  // The request inbox is the owner's alone — there is no server route for
  // anybody else's, and offering the tab would promise one.
  if (isOwner.value) {
    base.push({
      value: 'requests',
      label: auth.followCounts?.pending_requests
        ? `So'rovlar (${auth.followCounts.pending_requests})`
        : "So'rovlar",
    })
  }

  return base
})

async function load() {
  loading.value = true
  hasError.value = false
  forbidden.value = false
  notFound.value = false

  try {
    const { data } =
      tab.value === 'requests'
        ? await followsApi.requests(page.value)
        : tab.value === 'followers'
          ? await followsApi.followers(userId.value, page.value)
          : await followsApi.following(userId.value, page.value)

    people.value = data.data
    lastPage.value = data.meta.last_page
  } catch (e) {
    people.value = []

    // Three outcomes, three screens. A 404 here means "no such account, or it
    // blocked you" — deliberately the same answer — while a 403 means the
    // account is real and has closed this list. Collapsing them into one error
    // would either leak the difference or hide it in the wrong direction.
    if (isAxiosError(e) && e.response?.status === 403) {
      forbidden.value = true
    } else if (isAxiosError(e) && e.response?.status === 404) {
      notFound.value = true
    } else {
      hasError.value = true
    }
  } finally {
    loading.value = false
  }
}

function switchTab(next: string) {
  tab.value = next as Tab
  page.value = 1
  load()
}

function goToPage(next: number) {
  page.value = next
  load()
}

/**
 * Write a row's new relationship back into the list.
 *
 * The button owns the optimistic update and its rollback; this only stores
 * whatever state it hands back, so a rollback lands here too.
 */
function updateRelationship(personId: number, relationship: FollowRelationship) {
  const person = people.value.find((p) => p.id === personId)
  if (person) person.relationship = relationship
}

/**
 * The row's relationship, as the server resolved it.
 *
 * This used to derive `can_follow` here as "there is no follow row yet", which
 * is the client deciding an authorization question it cannot see the inputs to:
 * it ignores blocks and `who_can_follow`, so a list offered an enabled Follow
 * button for an account refusing followers and the tap came back 422. The
 * server now sends the complete relationship — see
 * `FollowService::relationshipsForMany` — and this only supplies defaults for a
 * payload that carries none at all, which is the anonymous case.
 */
function relationshipFor(person: FollowListUser): FollowRelationship {
  return (
    person.relationship ?? {
      is_following: false,
      follow_status: null,
      is_followed_by: false,
      // Never claim a follow can be started when the server did not say so.
      can_follow: false,
      follow_needs_approval: false,
    }
  )
}

/** Kept in script: the strings carry apostrophes that a template expression
 *  cannot hold without escaping into unreadability. */
const emptyTitle = computed(() => {
  if (tab.value === 'requests') return "Kutilayotgan so'rov yo'q"
  if (tab.value === 'followers') return "Hali kuzatuvchilar yo'q"
  return 'Hali hech kim kuzatilmayapti'
})

async function respond(personId: number, accept: boolean) {
  try {
    await (accept ? followsApi.accept(personId) : followsApi.reject(personId))
    people.value = people.value.filter((p) => p.id !== personId)
    // The tab badge is served beside /me, so it has to be re-read rather than
    // decremented locally.
    await auth.fetchMe().catch(() => undefined)
  } catch {
    await load()
  }
}

watch(() => [route.params.id, route.params.tab], () => {
  tab.value = (route.params.tab as Tab) ?? 'followers'
  page.value = 1
  load()
})

load()
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl pb-10">
      <h1 class="text-xl font-bold text-ink mb-4">
        {{ isOwner ? 'Kuzatuvlar' : 'Profil' }}
      </h1>

      <AppTabs :model-value="tab" :tabs="tabs" class="mb-4" @update:model-value="switchTab" />

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="card p-4 flex items-center gap-3">
          <Skeleton variant="circle" />
          <div class="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="25%" />
          </div>
        </div>
      </div>

      <EmptyState
        v-else-if="notFound"
        :icon="icons.profile"
        title="Foydalanuvchi topilmadi"
        description="Bu hisob mavjud emas yoki sizga ko'rinmaydi."
      />

      <EmptyState
        v-else-if="forbidden"
        :icon="icons.lock"
        title="Bu ro'yxat yopiq"
        description="Foydalanuvchi kuzatuvchilar ro'yxatini yashirgan."
      />

      <ErrorState v-else-if="hasError" @retry="load" />

      <EmptyState
        v-else-if="!people.length"
        :icon="icons.people"
        :title="emptyTitle"
      />

      <template v-else>
        <ul class="space-y-2">
          <li v-for="person in people" :key="person.id" class="card p-3 flex items-center gap-3">
            <RouterLink
              :to="userProfileRoute(person)!"
              class="flex items-center gap-3 flex-1 min-w-0"
            >
              <Avatar :src="person.profile?.avatar_url" :name="person.display_name" size="md" />
              <div class="min-w-0">
                <p class="font-medium text-ink truncate flex items-center gap-1.5">
                  {{ person.display_name }}
                  <VerificationBadge v-if="person.identity_verified" compact />
                </p>
                <p v-if="person.username" class="text-xs text-ink-faint truncate">
                  @{{ person.username }}
                </p>
              </div>
            </RouterLink>

            <div v-if="tab === 'requests'" class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                class="h-8 px-3 rounded-full bg-primary-600 text-white text-xs font-medium"
                @click="respond(person.id, true)"
              >
                Qabul qilish
              </button>
              <button
                type="button"
                class="h-8 px-3 rounded-full border border-border text-ink-muted text-xs font-medium"
                @click="respond(person.id, false)"
              >
                Rad etish
              </button>
            </div>

            <FollowButton
              v-else-if="person.id !== auth.user?.id"
              compact
              class="shrink-0"
              :user-id="person.id"
              :relationship="relationshipFor(person)"
              @update:relationship="(r) => updateRelationship(person.id, r)"
            />
          </li>
        </ul>

        <Pagination
          v-if="lastPage > 1"
          class="mt-5"
          :current-page="page"
          :last-page="lastPage"
          @update:current-page="goToPage"
        />
      </template>
    </div>
  </AppLayout>
</template>
