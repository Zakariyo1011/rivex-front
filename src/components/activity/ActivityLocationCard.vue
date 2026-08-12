<script setup lang="ts">
import { computed, ref } from 'vue'
import { icons } from '@/lib/icons'
import type { Activity } from '@/types'

const props = defineProps<{ activity: Activity }>()

/**
 * Where the meetup happens.
 *
 * This is the ACTIVITY's location, never the organiser's home — those are
 * separate records on the backend (activity_locations vs user_locations) and
 * only this one is public.
 *
 * Map strategy: OpenStreetMap's embed needs no API key and no account, so the
 * map works out of the box. `VITE_MAP_PROVIDER=none` turns the embed off (for
 * deployments that would rather not make a third-party request) and the card
 * degrades to the address plus an external link — never to a broken frame.
 */
const provider = (import.meta.env.VITE_MAP_PROVIDER ?? 'osm') as 'osm' | 'none'

const showMap = ref(false)

const coords = computed(() => {
  const lat = Number(props.activity.latitude)
  const lng = Number(props.activity.longitude)

  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
    ? { lat, lng }
    : null
})

const canEmbed = computed(() => provider === 'osm' && coords.value !== null)

const areaLabel = computed(() => {
  const parts = [
    props.activity.location?.district?.name,
    props.activity.location?.region?.name,
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : null
})

/** Small bbox around the pin — roughly a few streets, not a pinpoint address. */
const embedUrl = computed(() => {
  if (!coords.value) return ''
  const { lat, lng } = coords.value
  const d = 0.008
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(5)).join(',')

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
})

const externalUrl = computed(() => {
  if (!coords.value) return null
  const { lat, lng } = coords.value

  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
})
</script>

<template>
  <div class="rounded-2xl border border-border bg-surface overflow-hidden">
    <div class="p-4 flex items-start gap-3">
      <span
        class="w-10 h-10 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"
      >
        <FontAwesomeIcon :icon="icons.location" />
      </span>

      <div class="min-w-0 flex-1">
        <p class="font-semibold text-ink text-[15px]">{{ activity.location_name }}</p>
        <p v-if="areaLabel" class="text-sm text-ink-muted mt-0.5">{{ areaLabel }}</p>
        <p
          v-if="activity.distance_km !== undefined"
          class="text-xs text-primary-600 font-medium mt-1"
        >
          Sizdan ~{{ activity.distance_km }} km
        </p>
      </div>
    </div>

    <!-- Loaded on demand: no third-party request until the user asks for it. -->
    <div v-if="canEmbed" class="border-t border-border">
      <button
        v-if="!showMap"
        type="button"
        class="w-full px-4 py-3 text-sm font-medium text-primary-600 hover:bg-primary-50 transition flex items-center justify-center gap-2"
        @click="showMap = true"
      >
        <FontAwesomeIcon :icon="icons.locateMe" class="text-xs" />
        Xaritada ko'rish
      </button>

      <div v-else>
        <iframe
          :src="embedUrl"
          class="w-full h-56 border-0 block"
          loading="lazy"
          referrerpolicy="no-referrer"
          title="Uchrashuv joyi xaritada"
        />
        <a
          v-if="externalUrl"
          :href="externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="block px-4 py-2.5 text-xs text-center text-ink-muted hover:text-primary-600 transition"
        >
          Kattaroq xaritada ochish
        </a>
      </div>
    </div>

    <p v-else-if="provider !== 'none'" class="px-4 pb-4 text-xs text-ink-faint">
      Tashkilotchi aniq koordinatani ko'rsatmagan — joyni suhbatda aniqlashtiring.
    </p>
  </div>
</template>
