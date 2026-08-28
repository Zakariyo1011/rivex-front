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
import ChangePasswordModal from '@/components/settings/ChangePasswordModal.vue'
import PhoneNumberCard from '@/components/profile/PhoneNumberCard.vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { setStoredLocale, type Locale } from '@/i18n'
import { icons } from '@/lib/icons'
import { formatTestAware } from '@/lib/money'
import { extractErrorMessage } from '@/composables/useApiError'
import { onMounted, ref } from 'vue'

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
  { to: '/settings/privacy', icon: icons.trust, label: t('settings.privacy') },
  { to: '/settings/notifications', icon: icons.notifications, label: t('notifications.settings') },
  { to: '/no-show-reports', icon: icons.warning, label: 'Menga qarshi shikoyatlar' },
  { to: '/blocked-users', icon: icons.block, label: t('settings.blockedUsers') },
  { to: '/safety-center', icon: icons.trust, label: t('settings.safetyCenter') },
])

// Which delete confirmation to render, and whether the password row says
// "change" or "add", both depend on this. Fetched here rather than served with
// /me — see the store.
onMounted(() => {
  void auth.fetchSecurity().catch(() => undefined)
})

const showDeleteModal = ref(false)
const showPasswordModal = ref(false)

/**
 * Deleting a Google-only account is confirmed by typing the handle back —
 * there is no password to re-prove. Both inputs exist and the server decides
 * which one it needs, because only the server knows whether a password was
 * ever set.
 */
const deletePassword = ref('')
const deleteConfirmation = ref('')

const hasPassword = computed(() => auth.security?.has_password ?? false)

const verificationLabel = computed(() => {
  switch (auth.user?.verification_status) {
    case 'verified':
      return 'Tasdiqlangan'
    case 'pending':
    case 'needs_review':
      return "Ko'rib chiqilmoqda"
    case 'rejected':
      return 'Rad etilgan'
    default:
      return 'Tasdiqlanmagan'
  }
})
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
    await auth.deleteAccount(
      hasPassword.value
        ? { password: deletePassword.value }
        : { confirmation: deleteConfirmation.value },
    )
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

        <!-- One destination, not two links into the same screen.
             "Edit Profile" and "Username" both used to point at /profile/edit —
             the second one at an anchor inside it — so Account was two entries
             that opened the same page. They are different things with different
             rules, and Account is where both now live. -->
        <RouterLink
          :to="{ name: 'account-settings' }"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.profile" class="text-ink-faint w-4" />
            Hisob
          </span>
          <span class="flex items-center gap-2">
            <span v-if="auth.user?.username" class="text-sm text-ink-muted">
              @{{ auth.user.username }}
            </span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
        </RouterLink>

        <RouterLink
          :to="{ name: 'profile-edit' }"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.edit" class="text-ink-faint w-4" />
            {{ t('settings.editProfile') }}
          </span>
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
        </RouterLink>

        <RouterLink
          :to="{ name: 'wallet' }"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.wallet" class="text-ink-faint w-4" />
            Hamyon
          </span>
          <span class="flex items-center gap-2">
            <span v-if="auth.wallet" class="text-sm text-ink-muted">
              {{ formatTestAware(auth.wallet.balance, auth.wallet.currency, auth.wallet.test_mode) }}
            </span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
        </RouterLink>
      </AppCard>

      <AppCard class="mb-4" padding="none">
        <h2 class="font-semibold text-ink p-4 pb-2">Xavfsizlik</h2>

        <!-- How this account signs in. Read-only: Google IS the credential,
             and there is nothing here to change. -->
        <div class="flex items-center justify-between px-4 py-3.5 border-t border-border">
          <span class="flex items-center gap-3 text-sm font-medium text-ink min-w-0">
            <FontAwesomeIcon :icon="icons.verified" class="text-ink-faint w-4 shrink-0" />
            <span class="truncate">Google hisobi</span>
          </span>
          <span class="flex items-center gap-2 shrink-0 min-w-0">
            <span class="text-sm text-ink-muted truncate max-w-[10rem]">
              {{ auth.security?.google_email ?? auth.user?.name }}
            </span>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-success-bg text-success">
              Ulangan
            </span>
          </span>
        </div>

        <div class="border-t border-border">
          <PhoneNumberCard compact />
        </div>

        <button
          class="w-full flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition text-left"
          @click="showPasswordModal = true"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.lock" class="text-ink-faint w-4" />
            {{ hasPassword ? "Parolni o'zgartirish" : "Parol qo'shish" }}
          </span>
          <span class="flex items-center gap-2">
            <span v-if="!hasPassword" class="text-xs text-ink-faint">Ixtiyoriy</span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
        </button>

        <RouterLink
          to="/verification"
          class="flex items-center justify-between px-4 py-3.5 border-t border-border hover:bg-surface-muted transition"
        >
          <span class="flex items-center gap-3 text-sm font-medium text-ink">
            <FontAwesomeIcon :icon="icons.identity" class="text-ink-faint w-4" />
            Shaxsni tasdiqlash
          </span>
          <span class="flex items-center gap-2">
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="
                auth.user?.verification_status === 'verified'
                  ? 'bg-success-bg text-success'
                  : 'bg-surface-muted text-ink-muted'
              "
            >
              {{ verificationLabel }}
            </span>
            <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
          </span>
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

    <ChangePasswordModal
      v-if="showPasswordModal"
      :has-password="hasPassword"
      @close="showPasswordModal = false"
    />

    <AppModal v-if="showDeleteModal" :title="t('settings.deleteAccount')" @close="showDeleteModal = false">
      <p class="text-sm text-ink-secondary mb-4">
        Bu amalni bekor qilib bo'lmaydi. Hisobingiz, faoliyatlaringiz va suhbatlaringizga kirish imkoniyati butunlay
        yo'qoladi.
        {{
          hasPassword
            ? 'Davom etish uchun parolingizni kiriting.'
            : "Davom etish uchun foydalanuvchi nomingizni yozing."
        }}
      </p>
      <AppInput v-if="hasPassword" v-model="deletePassword" label="Parol" type="password" />
      <AppInput
        v-else
        v-model="deleteConfirmation"
        label="Foydalanuvchi nomi"
        :placeholder="auth.user?.username ?? auth.user?.name"
      />
      <p v-if="deleteError" class="text-sm text-danger mt-2">{{ deleteError }}</p>
      <AppButton class="mt-4" variant="danger" :loading="deleting" @click="confirmDeleteAccount">
        Hisobni butunlay o'chirish
      </AppButton>
    </AppModal>
  </AppLayout>
</template>
