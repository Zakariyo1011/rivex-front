<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import PhoneNumberCard from '@/components/profile/PhoneNumberCard.vue'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'

/**
 * A page for one field, and it earns it.
 *
 * The phone number is what unlocks creating and joining activities, so
 * something has to be able to link straight at it — a prompt on Home, a
 * refusal from the verification gate, a notification. Reaching it only by
 * scrolling Settings would make every one of those a dead end.
 */
const auth = useAuthStore()
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Telefon raqami</h1>
    </template>

    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <AppCard>
        <PhoneNumberCard />
      </AppCard>

      <AppCard class="mt-4">
        <h2 class="font-semibold text-ink mb-2 flex items-center gap-2">
          <FontAwesomeIcon :icon="icons.info" class="text-ink-faint text-sm" />
          Nima uchun kerak?
        </h2>
        <ul class="space-y-2 text-sm text-ink-secondary leading-relaxed">
          <li>Faoliyat yaratish va faoliyatga qo'shilish uchun.</li>
          <li>Uchrashuv oldidan sherigingiz siz bilan bog'lana olishi uchun.</li>
          <li>Hisobingiz xavfsizligi uchun qo'shimcha tasdiq sifatida.</li>
        </ul>

        <p class="text-xs text-ink-faint mt-4 leading-relaxed">
          Raqamingiz profilingizda ko'rinmaydi — boshqa foydalanuvchilar faqat
          uning tasdiqlanganini ko'radi.
        </p>
      </AppCard>

      <p v-if="auth.phone?.status === 'verified'" class="text-xs text-ink-faint mt-4">
        Raqamni istalgan vaqtda o'zgartirishingiz yoki o'chirishingiz mumkin.
      </p>
    </div>
  </AppLayout>
</template>
