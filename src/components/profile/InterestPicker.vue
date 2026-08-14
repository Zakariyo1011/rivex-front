<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { interestsApi, type Interest, type InterestGroup } from '@/api/interests'
import { icons } from '@/lib/icons'

const props = defineProps<{ selected: number[] }>()
const emit = defineEmits<{ 'update:selected': [ids: number[]] }>()

const groups = ref<InterestGroup[]>([])
const max = ref(20)
const loading = ref(true)
const failed = ref(false)

const chosen = computed(() => new Set(props.selected))
const atLimit = computed(() => props.selected.length >= max.value)

function toggle(interest: Interest) {
  const next = new Set(props.selected)

  if (next.has(interest.id)) {
    next.delete(interest.id)
  } else {
    // The ceiling is the server's; enforcing it here too means the user is
    // told before a save is refused rather than after.
    if (atLimit.value) return
    next.add(interest.id)
  }

  emit('update:selected', [...next])
}

onMounted(async () => {
  try {
    const { data } = await interestsApi.catalogue()
    groups.value = data.grouped
    max.value = data.max
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-ink-muted">
        Qiziqishlaringiz sizga mos odam va faoliyatlarni topishga yordam beradi.
      </p>
      <span
        class="text-xs font-medium shrink-0 ml-3"
        :class="atLimit ? 'text-warning' : 'text-ink-faint'"
      >
        {{ selected.length }}/{{ max }}
      </span>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="space-y-2">
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="90%" />
      </div>
    </div>

    <p v-else-if="failed" class="text-sm text-danger">
      Qiziqishlar ro'yxatini yuklab bo'lmadi.
    </p>

    <div v-else class="space-y-4">
      <div v-for="group in groups" :key="group.category">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
          {{ group.category }}
        </h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="interest in group.interests"
            :key="interest.id"
            type="button"
            class="inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-xs font-medium transition-colors"
            :class="
              chosen.has(interest.id)
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : atLimit
                  ? 'border-border text-ink-faint cursor-not-allowed'
                  : 'border-border text-ink-secondary hover:border-primary-300 hover:text-primary-700'
            "
            :aria-pressed="chosen.has(interest.id)"
            @click="toggle(interest)"
          >
            <FontAwesomeIcon
              v-if="chosen.has(interest.id)"
              :icon="icons.check"
              class="text-[0.65rem]"
            />
            {{ interest.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
