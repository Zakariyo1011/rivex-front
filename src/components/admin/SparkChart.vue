<script setup lang="ts">
import { computed } from 'vue'

/**
 * A small line chart, drawn as inline SVG.
 *
 * No charting library: the dashboard needs three sparklines, and a dependency
 * for that is a dependency to keep patched, bundle and theme. Inline SVG also
 * inherits `currentColor`, so it follows light and dark mode with no work.
 *
 * The y-axis starts at zero deliberately. A chart auto-scaled to its own
 * minimum makes a flat week look like a dramatic one, which on a revenue
 * dashboard is not a cosmetic difference.
 */
const props = withDefaults(
  defineProps<{
    points: number[]
    labels?: string[]
    height?: number
    /** Rendered under the chart. Kept out of the SVG so it wraps normally. */
    caption?: string
  }>(),
  { height: 64 },
)

const WIDTH = 240

const max = computed(() => Math.max(1, ...props.points))

const coords = computed(() => {
  const count = props.points.length

  if (count === 0) return []

  // A single point has no span to divide, so it sits in the middle.
  const step = count === 1 ? 0 : WIDTH / (count - 1)

  return props.points.map((value, index) => ({
    x: count === 1 ? WIDTH / 2 : index * step,
    y: props.height - (value / max.value) * (props.height - 4) - 2,
    value,
    label: props.labels?.[index],
  }))
})

const line = computed(() => coords.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

/** The same path closed along the baseline, for the fill under the line. */
const area = computed(() => {
  if (coords.value.length === 0) return ''

  const first = coords.value[0]!
  const last = coords.value[coords.value.length - 1]!

  return `${first.x},${props.height} ${line.value} ${last.x},${props.height}`
})

const isEmpty = computed(() => props.points.every((value) => value === 0))
</script>

<template>
  <div>
    <svg
      :viewBox="`0 0 ${WIDTH} ${height}`"
      preserveAspectRatio="none"
      class="w-full block"
      :style="{ height: `${height}px` }"
      role="img"
      :aria-label="caption ?? 'Chart'"
    >
      <polygon :points="area" class="fill-primary-500/10" />
      <polyline
        :points="line"
        fill="none"
        class="stroke-primary-500"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <p v-if="isEmpty" class="text-xs text-ink-faint mt-1">Ma'lumot yo'q</p>
    <p v-else-if="caption" class="text-xs text-ink-faint mt-1">{{ caption }}</p>
  </div>
</template>
