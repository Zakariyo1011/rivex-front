<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { usePrivacyStore } from '@/stores/privacy'
import { icons } from '@/lib/icons'
import type { FollowPolicy, Visibility } from '@/api/privacy'

const privacy = usePrivacyStore()

onMounted(() => privacy.fetch())
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl pb-10">
      <h1 class="text-xl font-bold text-ink mb-1">Maxfiylik</h1>
      <p class="text-sm text-ink-muted mb-5">
        Kim sizni topa olishini va profilingizda nimani ko'rishini boshqaring.
      </p>

      <div v-if="privacy.loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="text" width="70%" />
        </div>
      </div>

      <ErrorState v-else-if="!privacy.settings && privacy.error" @retry="privacy.fetch()" />

      <div v-else-if="privacy.settings && privacy.options" class="space-y-4">
        <p
          v-if="privacy.error"
          class="rounded-xl bg-danger-bg text-danger text-sm px-4 py-3"
          role="alert"
        >
          {{ privacy.error }}
        </p>

        <!-- Profile visibility -->
        <AppCard padding="none">
          <div class="p-4 pb-2">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.profile" class="text-ink-faint w-4" />
              Profilni kim ko'radi
            </h2>
          </div>

          <label
            v-for="option in privacy.options.visibility"
            :key="option.value"
            class="flex items-start gap-3 px-4 py-3.5 border-t border-border cursor-pointer hover:bg-surface-muted transition"
          >
            <input
              type="radio"
              name="profile_visibility"
              class="mt-1 accent-primary-600"
              :value="option.value"
              :checked="privacy.settings.profile_visibility === option.value"
              @change="privacy.update({ profile_visibility: option.value as Visibility })"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">{{ option.label }}</span>
              <span class="block text-xs text-ink-muted mt-0.5">{{ option.description }}</span>
            </span>
          </label>

          <!-- The consequence of a restricted profile, said out loud rather
               than left to be discovered after the fact. -->
          <p
            v-if="privacy.settings.follow_needs_approval"
            class="px-4 py-3 border-t border-border text-xs text-ink-muted flex items-start gap-2"
          >
            <FontAwesomeIcon :icon="icons.trust" class="text-primary-500 mt-0.5" />
            Profilingiz cheklangani uchun yangi kuzatuvchilar sizning tasdig'ingizni kutadi.
          </p>
        </AppCard>

        <!-- Follow policy -->
        <AppCard padding="none">
          <div class="p-4 pb-2">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.applications" class="text-ink-faint w-4" />
              Kim kuzata oladi
            </h2>
          </div>

          <label
            v-for="option in privacy.options.follow_policy"
            :key="option.value"
            class="flex items-start gap-3 px-4 py-3.5 border-t border-border cursor-pointer hover:bg-surface-muted transition"
          >
            <input
              type="radio"
              name="who_can_follow"
              class="mt-1 accent-primary-600"
              :value="option.value"
              :checked="privacy.settings.who_can_follow === option.value"
              @change="privacy.update({ who_can_follow: option.value as FollowPolicy })"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">{{ option.label }}</span>
              <span class="block text-xs text-ink-muted mt-0.5">{{ option.description }}</span>
            </span>
          </label>
        </AppCard>

        <!-- Followers list -->
        <AppCard padding="none">
          <div class="p-4 pb-2">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.profile" class="text-ink-faint w-4" />
              Kuzatuvchilar ro'yxatini kim ko'radi
            </h2>
          </div>

          <label
            v-for="option in privacy.options.visibility"
            :key="option.value"
            class="flex items-start gap-3 px-4 py-3.5 border-t border-border cursor-pointer hover:bg-surface-muted transition"
          >
            <input
              type="radio"
              name="who_can_see_followers"
              class="mt-1 accent-primary-600"
              :value="option.value"
              :checked="privacy.settings.who_can_see_followers === option.value"
              @change="privacy.update({ who_can_see_followers: option.value as Visibility })"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">{{ option.label }}</span>
            </span>
          </label>
        </AppCard>

        <!-- Switches -->
        <AppCard padding="none">
          <div class="p-4 pb-2">
            <h2 class="font-semibold text-ink flex items-center gap-2">
              <FontAwesomeIcon :icon="icons.explore" class="text-ink-faint w-4" />
              Topilish
            </h2>
          </div>

          <label
            class="flex items-start justify-between gap-3 px-4 py-3.5 border-t border-border cursor-pointer hover:bg-surface-muted transition"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">Qidiruvda ko'rinish</span>
              <span class="block text-xs text-ink-muted mt-0.5">
                O'chirilsa qidiruv natijalarida chiqmaysiz. Havolangiz baribir ochiladi.
              </span>
            </span>
            <input
              type="checkbox"
              class="mt-0.5 w-5 h-5 shrink-0 accent-primary-600"
              :checked="privacy.settings.discoverable_in_search"
              @change="
                privacy.update({
                  discoverable_in_search: ($event.target as HTMLInputElement).checked,
                })
              "
            />
          </label>

          <label
            class="flex items-start justify-between gap-3 px-4 py-3.5 border-t border-border cursor-pointer hover:bg-surface-muted transition"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">Onlayn holatim ko'rinsin</span>
              <span class="block text-xs text-ink-muted mt-0.5">
                O'chirilsa boshqalar qachon faol bo'lganingizni ko'rmaydi.
              </span>
            </span>
            <input
              type="checkbox"
              class="mt-0.5 w-5 h-5 shrink-0 accent-primary-600"
              :checked="privacy.settings.show_online_status"
              @change="
                privacy.update({ show_online_status: ($event.target as HTMLInputElement).checked })
              "
            />
          </label>
        </AppCard>

        <AppCard padding="none">
          <RouterLink
            to="/blocked-users"
            class="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition"
          >
            <span class="flex items-center gap-3 text-sm font-medium text-ink">
              <FontAwesomeIcon :icon="icons.block" class="text-ink-faint w-4" />
              Bloklangan foydalanuvchilar
            </span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </RouterLink>
        </AppCard>
      </div>
    </div>
  </AppLayout>
</template>
