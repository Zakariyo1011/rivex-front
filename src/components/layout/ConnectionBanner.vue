<script setup lang="ts">
import { computed } from 'vue'
import { echoConnectionState } from '@/composables/useEcho'
import { icons } from '@/lib/icons'

/**
 * A quiet strip that appears only when live updates are not flowing.
 *
 * Deliberately not an error state. A dropped WebSocket is normal — a tunnel, a
 * lock screen, a flaky café network — and the page still works: everything is
 * reachable over REST. Painting a red failure over a working screen would be
 * dishonest about the severity, so `reconnecting` is treated as a hint and only
 * a genuinely dead socket says so plainly.
 */
const state = computed(() => echoConnectionState.value)
</script>

<template>
  <Transition name="fade">
    <div
      v-if="state !== 'connected'"
      class="px-4 md:px-8 py-1.5 text-xs font-medium flex items-center justify-center gap-2"
      :class="
        state === 'reconnecting'
          ? 'bg-warning-bg text-warning'
          : 'bg-surface-muted text-ink-muted'
      "
      role="status"
    >
      <FontAwesomeIcon
        :icon="state === 'reconnecting' ? icons.spinner : icons.info"
        :class="{ 'fa-spin': state === 'reconnecting' }"
      />
      <span v-if="state === 'reconnecting'">Ulanish tiklanmoqda...</span>
      <span v-else>Jonli yangilanishlar o'chiq</span>
    </div>
  </Transition>
</template>
