<script setup lang="ts">
import { computed } from 'vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import { icons } from '@/lib/icons'
import type { UserLocation } from '@/types'

export type LocationScope = 'all' | 'near_me' | 'my_district' | 'my_region'

const props = defineProps<{
  scope: LocationScope
  radiusKm: number
  /** Null until the user has saved a region during onboarding. */
  userLocation: UserLocation | null
  gpsDenied: boolean
  locating: boolean
}>()

const emit = defineEmits<{
  'update:scope': [value: LocationScope]
  'update:radiusKm': [value: number]
}>()

/** Only offered when the user actually has a saved region/district to filter by. */
const scopes = computed(() => {
  const list: { value: LocationScope; label: string; icon?: typeof icons.location }[] = [
    { value: 'all', label: 'Hammasi' },
    { value: 'near_me', label: 'Yaqin atrofda', icon: icons.locateMe },
  ]

  if (props.userLocation?.district) {
    list.push({ value: 'my_district', label: props.userLocation.district.name, icon: icons.location })
  }

  if (props.userLocation?.region) {
    list.push({ value: 'my_region', label: props.userLocation.region.name, icon: icons.location })
  }

  return list
})

const radii = [1, 3, 5, 10, 25]
</script>

<template>
  <div class="space-y-2">
    <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
      <FilterChip
        v-for="option in scopes"
        :key="option.value"
        :active="scope === option.value"
        @click="emit('update:scope', option.value)"
      >
        <span class="flex items-center gap-1.5">
          <FontAwesomeIcon
            v-if="option.icon"
            :icon="scope === option.value && option.value === 'near_me' && locating ? icons.spinner : option.icon"
            :class="{ 'animate-spin': scope === option.value && option.value === 'near_me' && locating }"
            class="text-[11px]"
          />
          {{ option.label }}
        </span>
      </FilterChip>
    </div>

    <!-- Radius only means something once we have a fix to measure from. -->
    <div
      v-if="scope === 'near_me' && !gpsDenied"
      class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible"
    >
      <button
        v-for="km in radii"
        :key="km"
        type="button"
        class="shrink-0 h-8 px-3 rounded-full text-xs font-medium transition"
        :class="
          radiusKm === km
            ? 'bg-primary-600 text-white'
            : 'bg-surface-muted text-ink-muted hover:bg-primary-50 hover:text-primary-700'
        "
        @click="emit('update:radiusKm', km)"
      >
        {{ km }} km
      </button>
    </div>
  </div>
</template>
