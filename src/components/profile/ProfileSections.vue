<script setup lang="ts">
import { computed } from 'vue'
import AppCard from '@/components/ui/AppCard.vue'
import { sectionPresentation } from '@/lib/profileSections'
import { icons } from '@/lib/icons'
import type { ProfileSection } from '@/api/sections'

const props = defineProps<{
  sections: ProfileSection[]
  /** Only the owner sees per-section visibility and the edit affordance. */
  editable?: boolean
}>()

defineEmits<{ edit: [section: ProfileSection]; remove: [section: ProfileSection] }>()

/**
 * Sections with nothing in them are dropped rather than rendered as an empty
 * heading. The server already deletes a section when its contents go, so this
 * is belt and braces for the moment between a save and a refetch.
 */
const visible = computed(() =>
  props.sections.filter(
    (section) => section.text || section.items.length > 0 || section.kind === 'about',
  ),
)

const VISIBILITY_LABEL: Record<string, string> = {
  everyone: 'Hamma',
  followers: 'Kuzatuvchilar',
  only_me: 'Faqat men',
}

function subtitle(item: ProfileSection['items'][number]): string {
  // The one line under a title, assembled from whichever optional fields the
  // section actually filled in — so a book with no author does not render a
  // dangling separator.
  const parts = [item.role, item.degree, item.author, item.artist, item.country, item.level]
    .filter(Boolean)
    .map(String)

  const years = [item.from, item.year].filter(Boolean).map(String)
  if (item.to) years.push(String(item.to))
  else if (item.current) years.push('hozir')

  if (years.length) parts.push(years.join(' — '))

  return parts.join(' · ')
}
</script>

<template>
  <div v-if="visible.length" class="space-y-4">
    <AppCard v-for="section in visible" :key="section.id" padding="none">
      <div class="flex items-center justify-between gap-3 p-4 pb-2">
        <h2 class="font-semibold text-ink flex items-center gap-2 min-w-0">
          <FontAwesomeIcon
            v-if="sectionPresentation(section.kind)"
            :icon="sectionPresentation(section.kind)!.icon"
            class="text-ink-faint w-4 shrink-0"
          />
          <span class="truncate">{{ section.title }}</span>
        </h2>

        <div class="flex items-center gap-2 shrink-0">
          <span
            v-if="editable && section.visibility && section.visibility !== 'everyone'"
            class="text-[11px] rounded-full bg-surface-muted text-ink-muted px-2 py-0.5"
          >
            {{ VISIBILITY_LABEL[section.visibility] }}
          </span>
          <button
            v-if="editable"
            type="button"
            class="text-ink-faint hover:text-primary-600 transition-colors p-1"
            :aria-label="`${section.title} — tahrirlash`"
            @click="$emit('edit', section)"
          >
            <FontAwesomeIcon :icon="icons.edit" class="text-sm" />
          </button>
        </div>
      </div>

      <!-- Free text -->
      <p v-if="section.text" class="px-4 pb-4 text-sm text-ink-secondary whitespace-pre-line">
        {{ section.text }}
      </p>

      <!-- Tags and interests read as chips; everything else reads as a list -->
      <div
        v-else-if="section.source === 'tags' || section.source === 'interests'"
        class="px-4 pb-4 flex flex-wrap gap-2"
      >
        <span
          v-for="item in section.items"
          :key="item.slug ?? item.title"
          class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1.5"
        >
          {{ item.title }}
          <span v-if="item.level" class="text-primary-500/70">· {{ item.level }}</span>
        </span>
      </div>

      <div v-else-if="section.source === 'social_links'" class="px-4 pb-4 flex flex-wrap gap-2">
        <a
          v-for="item in section.items"
          :key="item.platform"
          :href="item.url"
          target="_blank"
          rel="nofollow noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-full border border-border text-ink-secondary hover:border-primary-300 hover:text-primary-700 text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {{ item.title }}
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-[0.6rem]" />
        </a>
      </div>

      <ul v-else class="px-4 pb-4 space-y-2.5">
        <li v-for="(item, index) in section.items" :key="index" class="flex gap-3">
          <span class="w-1.5 h-1.5 rounded-full bg-primary-400 mt-2 shrink-0" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">{{ item.title }}</p>
            <p v-if="subtitle(item)" class="text-xs text-ink-muted mt-0.5">{{ subtitle(item) }}</p>
            <p v-if="item.note" class="text-xs text-ink-faint mt-0.5">{{ item.note }}</p>
          </div>
        </li>
      </ul>
    </AppCard>
  </div>
</template>
