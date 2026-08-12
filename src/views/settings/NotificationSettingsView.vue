<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { notificationsApi } from '@/api/notifications'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type {
  NotificationCategoryKey,
  NotificationChannelKey,
  NotificationPreferences,
  NotificationPreferencesMeta,
} from '@/types'

/**
 * Per-category, per-channel notification switches.
 *
 * The category list, the labels and which channels actually work all come from
 * the server, so this screen has no second copy of that knowledge to drift out
 * of sync. Email and SMS are rendered but disabled — showing them greyed out is
 * honest about what exists, and the layout does not shift when they are wired
 * up later.
 */
const router = useRouter()
const toast = useToast()

const preferences = ref<NotificationPreferences | null>(null)
const meta = ref<NotificationPreferencesMeta | null>(null)
const loading = ref(true)
const hasError = ref(false)
const saving = ref(false)

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await notificationsApi.preferences()
    preferences.value = data.data
    meta.value = data.meta
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function isLocked(category: NotificationCategoryKey, channel: NotificationChannelKey): boolean {
  const categoryMeta = meta.value?.categories.find((c) => c.value === category)
  const channelMeta = meta.value?.channels.find((c) => c.value === channel)

  // A channel with no delivery path, or the security category's in-app switch,
  // which exists to warn about account takeover and must stay on.
  if (channelMeta && !channelMeta.available) return true

  return channel === 'in_app' && categoryMeta?.optional === false
}

async function toggle(category: NotificationCategoryKey, channel: NotificationChannelKey) {
  if (!preferences.value || isLocked(category, channel) || saving.value) return

  const previous = preferences.value[category][channel]
  preferences.value[category][channel] = !previous
  saving.value = true

  try {
    const { data } = await notificationsApi.updatePreferences(preferences.value)
    // The server is the authority — it drops values it will not honour.
    preferences.value = data.data
  } catch (e) {
    preferences.value[category][channel] = previous
    toast.error(extractErrorMessage(e))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <div class="flex items-center gap-3 mb-1 pr-14 tablet:pr-0">
        <button
          class="text-ink-muted md:hidden"
          aria-label="Orqaga"
          @click="router.push({ name: 'settings' })"
        >
          <FontAwesomeIcon :icon="icons.back" />
        </button>
        <h1 class="text-xl md:text-2xl font-bold text-ink">Bildirishnoma sozlamalari</h1>
      </div>
      <p class="text-sm text-ink-muted mb-5">
        Qaysi turdagi xabarlarni qayerda olishni tanlang.
      </p>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="70%" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <div v-else-if="preferences && meta" class="space-y-3">
        <AppCard v-for="category in meta.categories" :key="category.value" class="p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <p class="font-semibold text-ink">{{ category.label }}</p>
            <span v-if="!category.optional" class="text-xs text-ink-faint">
              Doimo yoqilgan
            </span>
          </div>

          <div class="space-y-2">
            <label
              v-for="channel in meta.channels"
              :key="channel.value"
              class="flex items-center justify-between gap-3 py-1.5"
              :class="isLocked(category.value, channel.value) ? 'opacity-50' : 'cursor-pointer'"
            >
              <span class="text-sm text-ink-secondary">
                {{ channel.label }}
                <span v-if="!channel.available" class="text-xs text-ink-faint">
                  — hozircha mavjud emas
                </span>
              </span>

              <button
                type="button"
                role="switch"
                :aria-checked="preferences[category.value][channel.value]"
                :aria-label="`${category.label} — ${channel.label}`"
                :disabled="isLocked(category.value, channel.value)"
                class="relative w-11 h-6 rounded-full transition shrink-0 disabled:cursor-not-allowed"
                :class="
                  preferences[category.value][channel.value] ? 'bg-primary-600' : 'bg-surface-muted border border-border'
                "
                @click="toggle(category.value, channel.value)"
              >
                <span
                  class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  :class="preferences[category.value][channel.value] ? 'left-[22px]' : 'left-0.5'"
                />
              </button>
            </label>
          </div>
        </AppCard>
      </div>
    </div>
  </AppLayout>
</template>
