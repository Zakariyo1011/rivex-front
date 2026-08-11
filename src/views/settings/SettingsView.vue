<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/layouts/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { setStoredLocale, type Locale } from '@/i18n'
import { icons } from '@/lib/icons'
import { extractErrorMessage } from '@/composables/useApiError'
import { ref } from 'vue'

const router = useRouter()
const { t, locale } = useI18n()
const theme = useThemeStore()
const auth = useAuthStore()

const themeTabs = computed(() => [
  { value: 'system', label: t('settings.themeSystem') },
  { value: 'light', label: t('settings.themeLight') },
  { value: 'dark', label: t('settings.themeDark') },
])

const languageTabs = [
  { value: 'uz', label: "O'zbek" },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
]

function setTheme(mode: string) {
  theme.setMode(mode as ThemeMode)
}

function setLanguage(value: string) {
  const next = value as Locale
  locale.value = next
  setStoredLocale(next)
}

const links = computed(() => [
  { to: '/blocked-users', icon: icons.block, label: t('settings.blockedUsers') },
  { to: '/safety-center', icon: icons.trust, label: t('settings.safetyCenter') },
])

const showDeleteModal = ref(false)
const deletePassword = ref('')
const deleting = ref(false)
const deleteError = ref('')

async function logout() {
  await auth.logout()
  router.push({ name: 'welcome' })
}

async function confirmDeleteAccount() {
  deleteError.value = ''
  deleting.value = true
  try {
    await auth.deleteAccount(deletePassword.value)
    router.push({ name: 'welcome' })
  } catch (e) {
    deleteError.value = extractErrorMessage(e)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <h1 class="text-xl font-bold text-ink mb-6">{{ t('settings.title') }}</h1>

      <AppCard class="mb-4">
        <h2 class="font-semibold text-ink mb-3">{{ t('settings.appearance') }}</h2>
        <p class="text-sm text-ink-muted mb-3">{{ t('settings.theme') }}</p>
        <AppTabs :tabs="themeTabs" :model-value="theme.mode" @update:model-value="setTheme" />
      </AppCard>

      <AppCard class="mb-4">
        <h2 class="font-semibold text-ink mb-3">{{ t('settings.language') }}</h2>
        <AppTabs :tabs="languageTabs" :model-value="locale" @update:model-value="setLanguage" />
      </AppCard>

      <AppCard class="mb-4" padding="none">
        <h2 class="font-semibold text-ink p-4 pb-2">{{ t('settings.account') }}</h2>
        <RouterLink
          to="/profile"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.edit" class="text-ink-faint w-4" />
            {{ t('settings.editProfile') }}
          </span>
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
        </RouterLink>
      </AppCard>

      <AppCard class="mb-4" padding="none">
        <h2 class="font-semibold text-ink p-4 pb-2">{{ t('settings.privacy') }}</h2>
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="link.icon" class="text-ink-faint w-4" />
            {{ link.label }}
          </span>
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
        </RouterLink>
      </AppCard>

      <AppButton variant="outline" @click="logout">{{ t('settings.logout') }}</AppButton>

      <AppCard class="mt-6" padding="none">
        <h2 class="font-semibold text-danger p-4 pb-2">{{ t('settings.dangerZone') }}</h2>
        <button
          class="flex items-center gap-3 px-4 py-3.5 border-t border-border text-sm font-medium text-danger w-full hover:bg-danger-bg transition"
          @click="showDeleteModal = true"
        >
          <FontAwesomeIcon :icon="icons.delete" class="w-4" />
          {{ t('settings.deleteAccount') }}
        </button>
      </AppCard>
    </div>

    <AppModal v-if="showDeleteModal" :title="t('settings.deleteAccount')" @close="showDeleteModal = false">
      <p class="text-sm text-ink-secondary mb-4">
        Bu amalni bekor qilib bo'lmaydi. Hisobingiz, faoliyatlaringiz va suhbatlaringizga kirish imkoniyati butunlay
        yo'qoladi. Davom etish uchun parolingizni kiriting.
      </p>
      <AppInput v-model="deletePassword" label="Parol" type="password" />
      <p v-if="deleteError" class="text-sm text-danger mt-2">{{ deleteError }}</p>
      <AppButton class="mt-4" variant="danger" :loading="deleting" @click="confirmDeleteAccount">
        Hisobni butunlay o'chirish
      </AppButton>
    </AppModal>
  </AppLayout>
</template>
