<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import UsernameEditor from '@/components/profile/UsernameEditor.vue'
import { icons } from '@/lib/icons'

/**
 * The one place a handle can be changed.
 *
 * It used to be a card inside "Edit Profile", reached from the profile page by
 * tapping your own `@name` — so the handle looked like the thing you tap to
 * rename yourself, and it sat among bio and avatar as if it were another
 * decoration. It is not: it is the account's identifier, it is quarantined for
 * thirty days when released, and it can only be changed on a cooldown. Those
 * are account rules, so it lives under Account.
 *
 * `UsernameEditor` itself is untouched and unduplicated — this screen is a
 * frame around the component that was already there, and every rule behind it
 * still lives in `UsernameService` on the server.
 */
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Foydalanuvchi nomi</h1>
    </template>

    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-xl pb-8">
      <RouterLink
        :to="{ name: 'account-settings' }"
        class="hidden tablet:inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <FontAwesomeIcon :icon="icons.chevronLeft" class="text-xs" />
        Hisob
      </RouterLink>

      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-5">Foydalanuvchi nomi</h1>

      <UsernameEditor />

      <p class="text-xs text-ink-faint mt-4 leading-relaxed">
        Foydalanuvchi nomi — profilingizning manzili. Uni o'zgartirsangiz, eski nomga
        havolalar ishlamay qoladi va eski nom bir muddat band bo'lib turadi.
      </p>
    </div>
  </AppLayout>
</template>
