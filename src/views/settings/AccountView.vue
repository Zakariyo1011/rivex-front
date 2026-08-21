<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'

/**
 * Account — the group Settings was missing.
 *
 * Settings had Appearance, Language, Security and Privacy, and the two things
 * that describe *the account itself* were filed under none of them: the profile
 * editor was reached from a link inside the Security card's neighbour, and the
 * handle was an anchor into the middle of that editor.
 *
 * The grouping is the point. "What people see" (Edit Profile) and "who this
 * account is" (the handle) belong together and belong apart from "how do I stay
 * signed in" — which is what Security means and where the handle had drifted.
 */
const auth = useAuthStore()
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Hisob</h1>
    </template>

    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-xl pb-8">
      <RouterLink
        :to="{ name: 'settings' }"
        class="hidden tablet:inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <FontAwesomeIcon :icon="icons.chevronLeft" class="text-xs" />
        Sozlamalar
      </RouterLink>

      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-5">Hisob</h1>

      <AppCard padding="none">
        <RouterLink
          :to="{ name: 'profile-edit' }"
          class="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.edit" class="text-ink-faint w-4" />
            Profilni tahrirlash
          </span>
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
        </RouterLink>

        <RouterLink
          :to="{ name: 'username-settings' }"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.profile" class="text-ink-faint w-4" />
            Foydalanuvchi nomi
          </span>
          <span class="flex items-center gap-2">
            <span v-if="auth.user?.username" class="text-sm text-ink-muted">
              @{{ auth.user.username }}
            </span>
            <span v-else class="text-sm text-ink-faint">Tanlanmagan</span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
        </RouterLink>
      </AppCard>

      <p class="text-xs text-ink-faint mt-4 px-1">
        Profilingiz boshqalarga qanday ko'rinishini boshqarish uchun
        <RouterLink :to="{ name: 'privacy-settings' }" class="text-primary-600 hover:underline">
          Maxfiylik
        </RouterLink>
        bo'limiga o'ting.
      </p>
    </div>
  </AppLayout>
</template>
