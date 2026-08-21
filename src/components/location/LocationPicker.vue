<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { locationsApi } from '@/api/locations'
import { useGeolocation } from '@/composables/useGeolocation'
import { icons } from '@/lib/icons'
import type { District, Region } from '@/types'

/**
 * Where an activity happens.
 *
 * One component for the create wizard and the edit form, because "where is
 * this" is the same question on both and two copies of it would answer it
 * differently — which is exactly what had happened: the wizard offered region
 * and district and no way to be precise, the edit form offered the same, and
 * neither ever sent a coordinate.
 *
 * ## The flow is Region → District → Place, and only the first is required
 *
 * That order is not decoration. A region is what every feed filter needs and is
 * the one thing an organiser always knows; a district narrows it usefully; the
 * meeting point is the sentence a participant actually navigates by. Asking for
 * them in that order means each answer makes the next one smaller.
 *
 * ## The precise point is optional, opt-in, and never a coordinate box
 *
 * 🔴 Nothing in the product ever set an activity's coordinate — the create form
 * did not send one — so `activities.latitude` was null on every row in the
 * database and the "near me" radius filter, which requires it, could not match
 * a single activity. It failed as an empty list, which reads as "nothing is
 * happening near you".
 *
 * The fix is not to demand a coordinate. Plenty of organisers genuinely do not
 * know the exact spot yet, and a required latitude field would be the worst
 * possible way to ask. So: one button that uses the device's own position, a
 * map preview to confirm it, and a clear way to remove it again. Nobody ever
 * types a number. The feed handles the rest, falling back to the district or
 * region centre for activities with no pin.
 *
 * ## Refusing location permission is a normal outcome
 *
 * Not an error path. If the browser says no, has no sensor, or times out, the
 * button explains itself once and the form carries on exactly as it would have
 * — the region and district selects are untouched and still sufficient to
 * publish. Nothing here can block a submission.
 */
const props = defineProps<{
  regionId: number | null
  districtId: number | null
  locationName: string
  latitude: number | null
  longitude: number | null
  errors?: Record<string, string | undefined>
  /** Placeholder for the meeting-point field, tailored to the activity type. */
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:regionId': [value: number | null]
  'update:districtId': [value: number | null]
  'update:locationName': [value: string]
  /** Both halves at once — a lone coordinate is refused by the server. */
  'update:coordinates': [value: { latitude: number; longitude: number } | null]
}>()

const geo = useGeolocation()

const regions = ref<Region[]>([])
const districts = ref<District[]>([])
const loadingRegions = ref(true)
const loadingDistricts = ref(false)
const locating = ref(false)
const regionsFailed = ref(false)

const mapProvider = (import.meta.env.VITE_MAP_PROVIDER ?? 'osm') as 'osm' | 'none'

const regionOptions = computed(() => regions.value.map((r) => ({ value: r.id, label: r.name })))

const districtOptions = computed(() => districts.value.map((d) => ({ value: d.id, label: d.name })))

const hasPin = computed(() => props.latitude !== null && props.longitude !== null)

const selectedRegion = computed(() => regions.value.find((r) => r.id === props.regionId) ?? null)
const selectedDistrict = computed(
  () => districts.value.find((d) => d.id === props.districtId) ?? null,
)

/** "Chilonzor, Toshkent shahri" — the area, as the participant will read it. */
const areaLabel = computed(() => {
  const parts = [selectedDistrict.value?.name, selectedRegion.value?.name].filter(Boolean)

  return parts.length ? parts.join(', ') : null
})

/** Small bbox around the pin — a few streets, not a doorstep. */
const mapUrl = computed(() => {
  if (!hasPin.value) return ''
  const d = 0.008
  const bbox = [
    props.longitude! - d,
    props.latitude! - d,
    props.longitude! + d,
    props.latitude! + d,
  ]
    .map((n) => n.toFixed(5))
    .join(',')

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${props.latitude},${props.longitude}`
})

async function loadDistricts(regionId: number | null) {
  districts.value = []

  if (regionId === null) return

  loadingDistricts.value = true
  try {
    const { data } = await locationsApi.districts(regionId)
    districts.value = data.data
  } catch {
    // A region without its districts is still a publishable location — the
    // district is optional, so this degrades to "not chosen" rather than
    // blocking the form.
  } finally {
    loadingDistricts.value = false
  }
}

function onRegionChange(value: string | number | null) {
  const next = value === null ? null : Number(value)

  emit('update:regionId', next)
  // The old district belonged to the old region; keeping it would fail the
  // server's district-belongs-to-region check with a confusing message.
  emit('update:districtId', null)

  void loadDistricts(next)
}

/**
 * Use the device's position as the meeting point.
 *
 * Deliberately does **not** touch the region or district. Reverse-geocoding a
 * fix to an administrative area is a guess, and a wrong guess that silently
 * rewrites a field the organiser already filled in is worse than no guess — the
 * onboarding screen does that inference once, where there is nothing to
 * overwrite. Here the pin is added beside what they chose.
 */
async function useCurrentPosition() {
  locating.value = true

  const coords = await geo.request()

  locating.value = false

  if (coords) emit('update:coordinates', { latitude: coords.lat, longitude: coords.lng })
}

function clearPin() {
  emit('update:coordinates', null)
}

onMounted(async () => {
  try {
    const { data } = await locationsApi.regions()
    regions.value = data.data
  } catch {
    regionsFailed.value = true
  } finally {
    loadingRegions.value = false
  }

  if (props.regionId !== null) await loadDistricts(props.regionId)
})

// An edit form fills its state after mount, so the district list has to follow
// the value rather than only the user's interaction with the select.
watch(
  () => props.regionId,
  (next, previous) => {
    if (next !== null && next !== previous && districts.value.length === 0) {
      void loadDistricts(next)
    }
  },
)
</script>

<template>
  <div class="space-y-4">
    <AppSelect
      :model-value="regionId"
      label="Viloyat"
      placeholder="Viloyatni tanlang"
      numeric
      :options="regionOptions"
      :disabled="loadingRegions"
      @update:model-value="onRegionChange"
    />
    <p v-if="errors?.region_id" class="-mt-2.5 text-xs text-danger">{{ errors.region_id }}</p>
    <p v-else-if="regionsFailed" class="-mt-2.5 text-xs text-danger">
      Viloyatlar ro'yxatini yuklab bo'lmadi. Sahifani yangilab ko'ring.
    </p>

    <AppSelect
      :model-value="districtId"
      label="Tuman (ixtiyoriy)"
      :placeholder="loadingDistricts ? 'Yuklanmoqda...' : 'Tuman tanlanmagan'"
      numeric
      :disabled="!regionId || loadingDistricts"
      :options="districtOptions"
      @update:model-value="emit('update:districtId', $event === null ? null : Number($event))"
    />
    <p v-if="errors?.district_id" class="-mt-2.5 text-xs text-danger">{{ errors.district_id }}</p>

    <AppInput
      :model-value="locationName"
      label="Uchrashuv joyi"
      :placeholder="placeholder ?? 'Masalan: Magic City, 2-qavat'"
      :error="errors?.location_name"
      hint="Ishtirokchi shu manzilga keladi — aniq yozing."
      maxlength="200"
      @update:model-value="emit('update:locationName', $event)"
    />

    <!-- The optional pin. Framed as a bonus rather than a missing field, so an
         organiser who does not know the exact spot yet is not left feeling the
         form is incomplete. -->
    <div class="rounded-2xl border border-border bg-surface-muted/60 p-4">
      <div class="flex items-start gap-3">
        <span
          class="w-9 h-9 shrink-0 rounded-xl bg-surface text-primary-600 flex items-center justify-center"
        >
          <FontAwesomeIcon :icon="icons.locateMe" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-ink">Aniq joyni belgilash</p>
          <p class="text-xs text-ink-muted mt-0.5">
            Ixtiyoriy. Belgilasangiz faoliyat xaritada ko'rinadi va "yaqin atrofda"
            qidiruvida aniqroq chiqadi.
          </p>
        </div>
      </div>

      <div v-if="hasPin" class="mt-3">
        <div
          class="flex items-center gap-2 text-sm text-success bg-success-bg rounded-xl px-3 py-2"
        >
          <FontAwesomeIcon :icon="icons.check" class="text-xs" />
          <span class="flex-1 min-w-0 truncate">Joy belgilandi</span>
          <button
            type="button"
            class="text-xs font-semibold text-ink-muted hover:text-danger transition"
            @click="clearPin"
          >
            O'chirish
          </button>
        </div>

        <iframe
          v-if="mapProvider === 'osm'"
          :src="mapUrl"
          class="w-full h-40 rounded-xl border border-border mt-3 block"
          loading="lazy"
          referrerpolicy="no-referrer"
          title="Tanlangan uchrashuv joyi"
        />
      </div>

      <button
        v-else
        type="button"
        class="mt-3 w-full h-11 rounded-xl border border-primary-200 bg-surface text-primary-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-50 transition disabled:opacity-60"
        :disabled="locating"
        @click="useCurrentPosition"
      >
        <FontAwesomeIcon
          :icon="locating ? icons.spinner : icons.locateMe"
          :class="{ 'animate-spin': locating }"
        />
        {{ locating ? 'Aniqlanmoqda...' : 'Hozirgi joylashuvimni ishlatish' }}
      </button>

      <!-- Refusal is a normal answer, not a failure. Said once, without an
           alarm colour, and the form carries on unchanged. -->
      <p v-if="!hasPin && geo.isDenied.value" class="text-xs text-ink-muted mt-2">
        Joylashuvga ruxsat berilmagan. Muammo emas — yuqoridagi viloyat va tuman
        yetarli, xohlasangiz brauzer sozlamalaridan ruxsat berib qayta urinib ko'ring.
      </p>
      <p
        v-else-if="!hasPin && (geo.state.value === 'error' || geo.state.value === 'unavailable')"
        class="text-xs text-ink-muted mt-2"
      >
        Joylashuvni aniqlab bo'lmadi. Viloyat va tuman bilan davom etishingiz mumkin.
      </p>
      <p v-if="errors?.latitude" class="text-xs text-danger mt-2">{{ errors.latitude }}</p>
    </div>

    <!-- What a participant will see, assembled from the answers above. Shown
         here so "where is this?" is answered on the form rather than only
         after publishing. -->
    <div v-if="areaLabel || locationName" class="flex items-start gap-2.5 text-sm">
      <FontAwesomeIcon :icon="icons.location" class="text-ink-faint mt-0.5 shrink-0" />
      <p class="text-ink-muted min-w-0">
        <span class="text-ink font-medium">{{ locationName || 'Uchrashuv joyi' }}</span>
        <template v-if="areaLabel"> · {{ areaLabel }}</template>
      </p>
    </div>
  </div>
</template>
