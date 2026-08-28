<script setup lang="ts">
import { icons } from '@/lib/icons'

/**
 * "This money is not real."
 *
 * Every screen that shows a balance renders this. It is deliberately not
 * dismissible and deliberately not subtle: the single failure this whole phase
 * is designed to prevent is somebody believing a test balance is money.
 *
 * `variant="inline"` is the compact form for a card footer; the default is the
 * full banner that sits above a page.
 */
withDefaults(defineProps<{ variant?: 'banner' | 'inline' }>(), { variant: 'banner' })
</script>

<template>
  <div
    v-if="variant === 'banner'"
    class="rounded-2xl border border-warning/30 bg-warning-bg px-4 py-3 flex items-start gap-3"
    data-testid="test-mode-banner"
  >
    <FontAwesomeIcon :icon="icons.testMode" class="text-warning mt-0.5 shrink-0" />
    <div class="min-w-0">
      <p class="text-sm font-semibold text-ink">TEST REJIMI</p>
      <p class="text-xs text-ink-secondary leading-relaxed mt-0.5">
        Bu yerdagi mablag' — sinov uchun. Haqiqiy pul ishlatilmaydi va yechib olinmaydi.
      </p>
    </div>
  </div>

  <p
    v-else
    class="text-xs text-ink-faint flex items-center gap-1.5"
    data-testid="test-mode-inline"
  >
    <FontAwesomeIcon :icon="icons.testMode" class="text-warning" />
    Test rejimi — haqiqiy pul emas
  </p>
</template>
