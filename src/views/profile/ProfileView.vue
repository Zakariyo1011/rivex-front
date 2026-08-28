<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import ProfileSections from '@/components/profile/ProfileSections.vue'
import { icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/auth'
import { useProfileSectionsStore } from '@/stores/profileSections'
import { locationsApi } from '@/api/locations'
import AppCard from '@/components/ui/AppCard.vue'
import PhoneNumberCard from '@/components/profile/PhoneNumberCard.vue'
import { formatTestAware } from '@/lib/money'
import { computed } from 'vue'

/**
 * Your own profile, as a profile — not as a form.
 *
 * This screen used to be both: a display card with an `editing` flag that
 * turned parts of it into inputs, while `/profile/edit` held the username field
 * and the section editor. The two were effectively swapped, which is why the
 * handle was edited by tapping the handle and why "Edit profile" contained no
 * profile fields.
 *
 * Everything editable now lives on /profile/edit. This screen shows what other
 * people see, plus the owner-only things (phone, completion, follow requests).
 */
const auth = useAuthStore()
const sections = useProfileSectionsStore()

const regionName = ref<string | null>(null)
const districtName = ref<string | null>(null)

const identity = computed(() => {
  switch (auth.user?.verification_status) {
    case 'verified':
      return { label: 'Tasdiqlangan', class: 'bg-success-bg text-success' }
    case 'pending':
    case 'needs_review':
      return { label: 'Tekshirilmoqda', class: 'bg-warning-bg text-warning' }
    case 'rejected':
      return { label: 'Rad etilgan', class: 'bg-danger-bg text-danger' }
    default:
      return { label: 'Tasdiqlanmagan', class: 'bg-surface-muted text-ink-muted' }
  }
})

onMounted(async () => {
  await auth.fetchMe()
  void sections.fetch()

  try {
    const { data } = await locationsApi.me()
    regionName.value = data.data.region?.name ?? null
    districtName.value = data.data.district?.name ?? null
  } catch {
    regionName.value = null
  }
})
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Profil</h1>
    </template>

    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="card p-6 text-center">
        <div
          class="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold overflow-hidden mx-auto"
        >
          <img
            v-if="auth.user?.profile.avatar_url"
            :src="auth.user.profile.avatar_url"
            class="w-full h-full object-cover"
            alt=""
          />
          <span v-else>{{ auth.user?.display_name?.[0] }}</span>
        </div>

        <h1 class="text-lg font-bold text-ink mt-3 flex items-center justify-center gap-1.5">
          {{ auth.user?.display_name }}
          <FontAwesomeIcon
            v-if="auth.user?.identity_verified"
            :icon="icons.verified"
            class="text-primary-500 text-sm"
          />
        </h1>

        <!-- Plain text. It was a link into the edit screen, which made the
             handle look like the thing you tap to rename yourself — the odd
             flow this phase removes. It is an identity here, not a control. -->
        <p v-if="auth.user?.username" class="text-sm text-ink-faint">@{{ auth.user.username }}</p>

        <!-- Google, as a badge. It is how this account exists, so it belongs
             beside the identity rather than buried in Settings. -->
        <p class="text-xs text-ink-muted mt-1.5 inline-flex items-center gap-1.5">
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-muted text-ink-secondary font-medium"
          >
            <FontAwesomeIcon :icon="icons.verified" class="text-[0.6rem] text-success" />
            Google
          </span>
        </p>

        <div
          v-if="auth.followCounts && auth.user"
          class="flex items-center justify-center gap-5 mt-3 text-sm"
        >
          <RouterLink
            :to="{ name: 'follow-list', params: { id: String(auth.user.id), tab: 'followers' } }"
            class="hover:text-primary-600 transition-colors"
          >
            <span class="font-bold text-ink">{{ auth.followCounts.followers }}</span>
            <span class="text-ink-muted ml-1">kuzatuvchi</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'follow-list', params: { id: String(auth.user.id), tab: 'following' } }"
            class="hover:text-primary-600 transition-colors"
          >
            <span class="font-bold text-ink">{{ auth.followCounts.following }}</span>
            <span class="text-ink-muted ml-1">kuzatilmoqda</span>
          </RouterLink>
        </div>

        <RouterLink
          v-if="auth.followCounts?.pending_requests && auth.user"
          :to="{ name: 'follow-list', params: { id: String(auth.user.id), tab: 'requests' } }"
          class="inline-flex items-center gap-1.5 mt-3 px-3 h-8 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
        >
          <FontAwesomeIcon :icon="icons.people" />
          {{ auth.followCounts.pending_requests }} ta kuzatuv so'rovi
        </RouterLink>

        <!-- The one way into editing, and it says so. -->
        <RouterLink
          :to="{ name: 'profile-edit' }"
          class="mt-4 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-border bg-surface text-sm font-medium text-ink-secondary hover:border-primary-300 hover:text-primary-700 transition-colors"
        >
          <FontAwesomeIcon :icon="icons.edit" class="text-[0.7rem]" />
          Profilni tahrirlash
        </RouterLink>

        <RouterLink
          v-if="auth.completion && auth.completion.percent < 100"
          :to="{ name: 'profile-edit' }"
          class="block mt-4 pt-4 border-t border-border text-left"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-medium text-ink-secondary">Profil to'liqligi</span>
            <span class="text-xs font-bold text-primary-600">{{ auth.completion.percent }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-surface-muted overflow-hidden">
            <div
              class="h-full rounded-full bg-primary-500 transition-all duration-500"
              :style="{ width: `${auth.completion.percent}%` }"
            />
          </div>
          <p class="text-xs text-ink-faint mt-1.5">To'ldirish uchun bosing</p>
        </RouterLink>

        <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <p class="font-bold text-ink">{{ auth.user?.rating_average ?? '—' }}</p>
            <p class="text-xs text-ink-muted flex items-center justify-center gap-1">
              <FontAwesomeIcon :icon="icons.starSolid" class="text-star" /> Reyting
            </p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ auth.user?.completed_activities_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Yakunlangan</p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ auth.user?.reviews_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Sharhlar</p>
          </div>
        </div>

        <div
          v-if="auth.user?.trust_score !== undefined"
          class="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2"
        >
          <span class="text-sm text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.trust" /> Trust score
          </span>
          <span class="text-sm font-bold text-primary-600">{{ auth.user.trust_score }}%</span>
        </div>
      </div>

      <div
        v-if="auth.user?.profile.bio || auth.user?.profile.location_name || auth.user?.profile.age || regionName"
        class="card p-5 mt-4"
      >
        <h2 class="font-semibold text-ink mb-3">Profil ma'lumotlari</h2>

        <div class="space-y-2 text-sm">
          <p v-if="auth.user?.profile.bio" class="text-ink-secondary">
            {{ auth.user.profile.bio }}
          </p>
          <p v-if="auth.user?.profile.location_name" class="text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.location" class="text-ink-faint text-xs" />
            {{ auth.user.profile.location_name }}
          </p>
          <p v-if="regionName" class="text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.locateMe" class="text-ink-faint text-xs" />
            {{ regionName }}<span v-if="districtName">, {{ districtName }}</span>
          </p>
          <p v-if="auth.user?.profile.age" class="text-ink-muted">{{ auth.user.profile.age }} yosh</p>
        </div>
      </div>

      <!-- Account: the things this profile IS, as opposed to what it shows.
           Phone, identity and wallet live together because they are the three
           facts that decide what the account may do. -->
      <AppCard class="mt-4" padding="none">
        <h2 class="font-semibold text-ink p-4 pb-2">Hisob ma'lumotlari</h2>

        <div class="border-t border-border">
          <PhoneNumberCard compact />
        </div>

        <RouterLink
          to="/verification"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 min-w-0">
            <FontAwesomeIcon :icon="icons.identity" class="text-ink-faint w-4 shrink-0" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">Shaxsni tasdiqlash</span>
              <span class="block text-sm text-ink-muted truncate">Pasport yoki ID karta</span>
            </span>
          </span>
          <span class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="identity.class">
              {{ identity.label }}
            </span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
        </RouterLink>

        <RouterLink
          :to="{ name: 'wallet' }"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
          data-testid="profile-wallet-link"
        >
          <span class="flex items-center gap-3 min-w-0">
            <FontAwesomeIcon :icon="icons.wallet" class="text-ink-faint w-4 shrink-0" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">Hamyon</span>
              <span v-if="auth.wallet" class="block text-sm text-ink-muted truncate">
                {{
                  formatTestAware(auth.wallet.balance, auth.wallet.currency, auth.wallet.test_mode)
                }}
              </span>
            </span>
          </span>
          <span class="flex items-center gap-2 shrink-0">
            <span
              v-if="auth.wallet?.test_mode"
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-bg text-warning"
            >
              TEST
            </span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
        </RouterLink>
      </AppCard>

      <!-- Interests, skills, hobbies, languages and the rest, exactly as
           another person would see them. -->
      <ProfileSections :sections="sections.sections" class="mt-4" />

      <div class="mt-4">
        <RouterLink to="/settings" class="card card-hover p-4 flex items-center justify-between">
          <span class="font-medium text-ink flex items-center gap-2.5">
            <FontAwesomeIcon :icon="icons.settings" class="text-ink-faint w-4" />
            Sozlamalar
          </span>
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
        </RouterLink>
      </div>
    </div>
  </AppLayout>
</template>
