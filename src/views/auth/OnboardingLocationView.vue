<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { locationsApi } from '@/api/locations'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { District, Region } from '@/types'

const router = useRouter()

const regions = ref<Region[]>([])
const districts = ref<District[]>([])
const regionId = ref<number | null>(null)
const districtId = ref<number | null>(null)
const coords = ref<{ lat: number; lng: number } | null>(null)
const locating = ref(false)
const saving = ref(false)
const error = ref('')

const canContinue = computed(() => !!regionId.value)

async function loadDistricts(id: number) {
  districtId.value = null
  const { data } = await locationsApi.districts(id)
  districts.value = data.data
}

async function onRegionChange() {
  if (regionId.value) await loadDistricts(regionId.value)
}

async function locateWithGps() {
  if (!navigator.geolocation) return
  locating.value = true
  error.value = ''
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    })
    const lat = position.coords.latitude
    const lng = position.coords.longitude
    coords.value = { lat, lng }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uz`,
    )
    const place = await response.json()
    const guess: string | undefined = place?.address?.state || place?.address?.region

    if (guess) {
      const match = regions.value.find(
        (r) => guess.toLowerCase().includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(guess.toLowerCase()),
      )
      if (match) {
        regionId.value = match.id
        await loadDistricts(match.id)
      }
    }
  } catch {
    // foydalanuvchi ruxsat bermadi yoki xato — qo'lda tanlashda davom etadi
  } finally {
    locating.value = false
  }
}

async function onSubmit() {
  if (!canContinue.value) return
  error.value = ''
  saving.value = true
  try {
    await locationsApi.updateMe({
      region_id: regionId.value,
      district_id: districtId.value ?? undefined,
      latitude: coords.value?.lat,
      longitude: coords.value?.lng,
    })
    router.push({ name: 'home' })
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    saving.value = false
  }
}

function skip() {
  router.push({ name: 'home' })
}

onMounted(async () => {
  const { data } = await locationsApi.regions()
  regions.value = data.data
})
</script>

<template>
  <AuthLayout :show-brand-panel="false">
    <div class="text-center mb-8">
      <div class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl text-primary-600 mx-auto mb-4">
        <FontAwesomeIcon :icon="icons.location" />
      </div>
      <h2 class="text-2xl font-bold text-ink">Joylashuvingiz</h2>
      <p class="text-ink-muted mt-1">Yaqin atrofdagi faoliyatlarni topishimiz uchun kerak</p>
    </div>

    <div class="space-y-4">
      <label class="block">
        <span class="block text-sm font-medium text-ink-secondary mb-1.5">Davlat</span>
        <div class="w-full h-12 px-4 rounded-xl border border-border bg-surface-muted text-[15px] flex items-center text-ink-muted">
          🇺🇿 O'zbekiston
        </div>
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-ink-secondary mb-1.5">Viloyat</span>
        <select
          v-model.number="regionId"
          class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
          @change="onRegionChange"
        >
          <option :value="null" disabled>Viloyatni tanlang</option>
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-ink-secondary mb-1.5">Tuman (ixtiyoriy)</span>
        <select
          v-model.number="districtId"
          :disabled="!regionId"
          class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-surface-muted disabled:text-ink-faint"
        >
          <option :value="null">Tuman tanlanmagan</option>
          <option v-for="d in districts" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </label>

      <button
        type="button"
        class="w-full h-11 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        :disabled="locating"
        @click="locateWithGps"
      >
        <FontAwesomeIcon :icon="icons.locateMe" />
        {{ locating ? 'Aniqlanmoqda...' : 'GPS bilan aniqlash' }}
      </button>

      <p v-if="error" class="text-sm text-danger text-center">{{ error }}</p>

      <AppButton :disabled="!canContinue" :loading="saving" @click="onSubmit">Davom etish</AppButton>

      <button type="button" class="w-full text-center text-sm text-ink-faint" @click="skip">
        Keyinroq
      </button>
    </div>
  </AuthLayout>
</template>
