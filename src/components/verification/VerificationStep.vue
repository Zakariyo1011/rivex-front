<script setup lang="ts">
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { icons } from '@/lib/icons'

/**
 * Shared chrome for the KYC wizard: back control, step dots, icon, title.
 * Keeping it in one place is what makes the four screens feel like one flow
 * rather than four forms that happen to be next to each other.
 */
withDefaults(
  defineProps<{
    icon: IconDefinition
    title: string
    description?: string
    /** 1-based; omit on screens that sit outside the wizard (e.g. status). */
    step?: number
    totalSteps?: number
    showBack?: boolean
  }>(),
  { totalSteps: 3, showBack: true },
)

defineEmits<{ back: [] }>()
</script>

<template>
  <div class="min-h-dvh bg-surface-muted">
    <div class="mx-auto w-full max-w-lg px-4 py-6 md:py-10">
      <div class="flex items-center gap-3 mb-8 min-h-9">
        <button
          v-if="showBack"
          type="button"
          class="w-9 h-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface transition"
          aria-label="Orqaga"
          @click="$emit('back')"
        >
          <FontAwesomeIcon :icon="icons.back" />
        </button>

        <div v-if="step" class="flex items-center gap-1.5 ml-auto" role="progressbar" :aria-valuenow="step" :aria-valuemax="totalSteps">
          <span
            v-for="i in totalSteps"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-300"
            :class="i <= step ? 'w-6 bg-primary-600' : 'w-1.5 bg-border'"
          />
        </div>
      </div>

      <div class="text-center mb-8">
        <div
          class="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 text-2xl flex items-center justify-center mx-auto mb-4"
        >
          <FontAwesomeIcon :icon="icon" />
        </div>
        <h1 class="text-2xl font-bold text-ink">{{ title }}</h1>
        <p v-if="description" class="text-ink-muted mt-2 text-[15px] leading-relaxed">{{ description }}</p>
      </div>

      <slot />
    </div>
  </div>
</template>
