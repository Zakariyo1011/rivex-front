<script setup lang="ts">
import { categoryIcon } from '@/lib/icons'
import type { Category } from '@/types'

defineProps<{ category: Category }>()
</script>

<template>
  <li class="card p-3">
    <RouterLink
      :to="{ name: 'explore', query: { category_id: String(category.id) } }"
      class="flex items-center gap-3"
    >
      <span
        class="w-10 h-10 rounded-xl bg-surface-muted text-primary-600 flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon :icon="categoryIcon(category.parent?.slug ?? category.slug)" />
      </span>

      <div class="min-w-0 flex-1">
        <!-- Parent first, so a bare "PlayStation" says which shelf it is on. -->
        <p class="text-xs text-ink-faint truncate" v-if="category.parent">
          {{ category.parent.name }} ›
        </p>
        <p class="font-medium text-ink truncate">{{ category.name }}</p>
      </div>

      <span
        v-if="category.activities_count !== undefined"
        class="text-xs shrink-0"
        :class="category.activities_count ? 'text-primary-600 font-medium' : 'text-ink-faint'"
      >
        {{ category.activities_count }} ta
      </span>
    </RouterLink>
  </li>
</template>
