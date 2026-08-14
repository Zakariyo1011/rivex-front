<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ProfileSections from '@/components/profile/ProfileSections.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import FollowButton from '@/components/profile/FollowButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import { isAxiosError } from 'axios'
import { profileApi } from '@/api/profile'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { ProfileSection } from '@/api/sections'
import type { FollowCounts, FollowRelationship, User, Review } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const user = ref<User | null>(null)
const reviews = ref<Review[]>([])
const sections = ref<ProfileSection[]>([])
const loading = ref(true)
const hasError = ref(false)
const notFound = ref(false)

/**
 * The viewer's tie to this person, and the totals.
 *
 * Both arrive beside `data` rather than inside it — the user resource is the
 * broadcast shape, and neither of these belongs on a payload delivered to
 * everybody. `followCounts` is null when `who_can_see_followers` withholds it,
 * which is not the same as zero and is rendered differently.
 */
const relationship = ref<FollowRelationship | null>(null)
const followCounts = ref<FollowCounts | null>(null)

/**
 * One screen, two URLs: `/u/{username}` is canonical, `/users/{id}` is the
 * legacy route that internal links still produce. Both render the same
 * profile, so the only difference is how the first request is addressed —
 * after that everything keys off the id the server returned.
 */
async function load() {
  loading.value = true
  hasError.value = false
  notFound.value = false
  sections.value = []
  relationship.value = null
  followCounts.value = null
  try {
    const username = route.params.username as string | undefined

    const userRes = username
      ? await profileApi.showByUsername(username)
      : await profileApi.show(Number(route.params.id))

    user.value = userRes.data.data
    // Sections ride beside `data` rather than inside it — see the profile
    // endpoint for why they are kept out of the user resource.
    sections.value = (userRes.data as { sections?: ProfileSection[] }).sections ?? []

    const extra = userRes.data as {
      relationship?: FollowRelationship
      follow_counts?: FollowCounts | null
    }
    relationship.value = extra.relationship ?? null
    followCounts.value = extra.follow_counts ?? null

    reviews.value = []

    // Reviews are profile contents, so a restricted profile refuses them.
    // Fetched separately and allowed to fail on its own: letting a 403 here
    // reject the whole load would replace a perfectly good "this profile is
    // private" card with a generic error screen.
    if (!user.value.is_restricted) {
      try {
        const reviewsRes = (await profileApi.reviews(user.value.id)) as {
          data: { data: Review[] }
        }
        reviews.value = reviewsRes.data.data
      } catch {
        reviews.value = []
      }
    }
  } catch (e) {
    // A 404 here is deliberately indistinguishable from a handle nobody holds:
    // the server answers the same way for an account that does not exist and
    // one that has blocked this viewer. Showing "something went wrong" would
    // be both wrong and a hint that there is something there.
    if (isAxiosError(e) && e.response?.status === 404) {
      notFound.value = true
    } else {
      hasError.value = true
    }
  } finally {
    loading.value = false
  }
}

/**
 * Store the button's new relationship and move the follower count with it.
 *
 * The count is derived from the transition rather than refetched: the profile
 * would otherwise show "0 kuzatuvchi" beside a button reading "Kuzatilmoqda"
 * until a reload. Deriving it also means the rollback is free — the button
 * emits the restored relationship on failure, this sees the reverse transition,
 * and the number goes back with it.
 */
function applyRelationship(next: FollowRelationship) {
  const was = relationship.value?.is_following ?? false
  relationship.value = next

  if (!followCounts.value || was === next.is_following) return

  followCounts.value = {
    ...followCounts.value,
    followers: Math.max(0, followCounts.value.followers + (next.is_following ? 1 : -1)),
  }
}

watch(() => [route.params.id, route.params.username], load)

onMounted(load)
</script>

<template>
  <AppLayout>
    <div v-if="loading" class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="card p-6 text-center space-y-3">
        <Skeleton variant="circle" width="5rem" height="5rem" class="mx-auto" />
        <Skeleton variant="text" width="50%" class="mx-auto" />
        <Skeleton variant="text" width="35%" class="mx-auto" />
      </div>
    </div>

    <EmptyState
      v-else-if="notFound"
      :icon="icons.profile"
      title="Foydalanuvchi topilmadi"
      description="Bu profil mavjud emas yoki sizga ochiq emas."
    />

    <ErrorState v-else-if="hasError" @retry="load" />

    <div v-else-if="user" class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="card p-6 text-center relative">
        <div v-if="user.id !== auth.user?.id" class="absolute top-4 right-4">
          <ReportBlockMenu :user-id="user.id" :user-name="user.name" />
        </div>

        <div class="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold overflow-hidden mx-auto">
          <img v-if="user.profile.avatar_url" :src="user.profile.avatar_url" class="w-full h-full object-cover" />
          <span v-else>{{ user.display_name[0] }}</span>
        </div>
        <h1 class="text-lg font-bold text-ink mt-3 flex items-center justify-center gap-1.5">
          {{ user.display_name }}
          <VerificationBadge v-if="user.identity_verified" compact />
        </h1>
        <p v-if="user.username" class="text-sm text-ink-faint">@{{ user.username }}</p>
        <p v-if="user.profile.location_name" class="text-sm text-ink-muted flex items-center justify-center gap-1.5">
          <FontAwesomeIcon :icon="icons.location" class="text-ink-faint text-xs" /> {{ user.profile.location_name }}
        </p>

        <!-- Counts sit above the follow button, and are links: a follower
             number nobody can tap is trivia. Absent rather than zero when the
             account withholds them — see follow_counts. -->
        <div
          v-if="followCounts"
          class="flex items-center justify-center gap-5 mt-3 text-sm"
        >
          <RouterLink
            :to="{ name: 'follow-list', params: { id: String(user.id), tab: 'followers' } }"
            class="hover:text-primary-600 transition-colors"
          >
            <span class="font-bold text-ink">{{ followCounts.followers }}</span>
            <span class="text-ink-muted ml-1">kuzatuvchi</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'follow-list', params: { id: String(user.id), tab: 'following' } }"
            class="hover:text-primary-600 transition-colors"
          >
            <span class="font-bold text-ink">{{ followCounts.following }}</span>
            <span class="text-ink-muted ml-1">kuzatilmoqda</span>
          </RouterLink>
        </div>

        <!-- Rendered for a restricted profile too: this is exactly the screen
             where somebody decides whether to ask, and the button carries the
             pending state that tells them they already have. -->
        <div v-if="relationship && user.id !== auth.user?.id" class="mt-4 flex justify-center">
          <FollowButton
            :user-id="user.id"
            :relationship="relationship"
            @update:relationship="applyRelationship"
          />
        </div>

        <!-- Verification is a fact about the account; rating and trust score are
             judgements about behaviour. They are shown as separate signals on
             purpose — a verified newcomer is not the same as a trusted regular. -->
        <div class="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span
            v-if="user.identity_verified"
            class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1"
          >
            <FontAwesomeIcon :icon="icons.identity" /> Shaxsi tasdiqlangan
          </span>
          <span
            v-if="user.phone_verified"
            class="inline-flex items-center gap-1.5 rounded-full bg-success-bg text-success text-xs font-medium px-2.5 py-1"
          >
            <FontAwesomeIcon :icon="icons.phone" /> Telefon tasdiqlangan
          </span>
        </div>

        <!-- A closed profile, said plainly. Rendering the empty shell without
             this would read as a person who never filled anything in. -->
        <div
          v-if="user.is_restricted"
          class="mt-5 pt-5 border-t border-border flex flex-col items-center gap-2"
        >
          <span
            class="w-10 h-10 rounded-full bg-surface-muted text-ink-faint flex items-center justify-center"
          >
            <FontAwesomeIcon :icon="icons.block" />
          </span>
          <p class="text-sm font-medium text-ink">Bu profil yopiq</p>
          <p class="text-xs text-ink-muted max-w-xs">
            Foydalanuvchi profilini kim ko'rishini cheklab qo'ygan.
          </p>
        </div>

        <template v-else>
        <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <p class="font-bold text-ink">{{ user.rating_average ?? '—' }}</p>
            <p class="text-xs text-ink-muted flex items-center justify-center gap-1">
              <FontAwesomeIcon :icon="icons.starSolid" class="text-star" /> Reyting
            </p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ user.completed_activities_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Yakunlangan</p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ user.reviews_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Sharhlar</p>
          </div>
        </div>

        <div v-if="user.trust_score !== undefined" class="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2">
          <span class="text-sm text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.trust" /> Trust score
          </span>
          <span class="text-sm font-bold text-primary-600">{{ user.trust_score }}%</span>
        </div>

        <p v-if="user.profile.bio" class="text-sm text-ink-secondary mt-4">{{ user.profile.bio }}</p>
        </template>
      </div>

      <ProfileSections v-if="!user.is_restricted" :sections="sections" class="mt-5" />

      <div v-if="!user.is_restricted" class="mt-5">
        <h2 class="font-semibold text-ink mb-3">Sharhlar</h2>
        <p v-if="reviews.length === 0" class="text-sm text-ink-faint">Hozircha sharhlar yo'q.</p>
        <div v-else class="space-y-3">
          <div v-for="review in reviews" :key="review.id" class="card p-4">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="font-medium text-ink text-sm">{{ review.reviewer.name }}</span>
              <span class="text-star text-sm flex items-center gap-0.5">
                <FontAwesomeIcon v-for="n in review.rating ?? 0" :key="n" :icon="icons.starSolid" class="text-[0.85em]" />
              </span>
            </div>
            <p v-if="review.comment" class="text-sm text-ink-muted">{{ review.comment }}</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
