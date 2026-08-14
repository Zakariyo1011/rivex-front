<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import ProfileSections from '@/components/profile/ProfileSections.vue'
import SectionEditor from '@/components/profile/SectionEditor.vue'
import UsernameEditor from '@/components/profile/UsernameEditor.vue'
import { useProfileSectionsStore } from '@/stores/profileSections'
import { useAuthStore } from '@/stores/auth'
import { ADDABLE_KINDS, sectionPresentation } from '@/lib/profileSections'
import { icons } from '@/lib/icons'
import type { ProfileSection, SectionItem, SectionKind, SocialLink, TagItem, TagType, UpsertSectionPayload } from '@/api/sections'
import type { Visibility } from '@/api/privacy'

const store = useProfileSectionsStore()
const auth = useAuthStore()

const editing = ref<{ kind: SectionKind; existing: ProfileSection | null } | null>(null)

const completion = computed(() => auth.completion)

/**
 * Sections not yet on the profile. Custom is always offered — a person may
 * have several — while the standard ones disappear from the list once added,
 * so "add a section" never means "overwrite the one I have".
 */
const addable = computed(() =>
  ADDABLE_KINDS.filter(
    (kind) => kind === 'custom' || !store.sections.some((section) => section.kind === kind),
  ),
)

/**
 * The completion meter lives beside /me, not in the sections response, so it
 * does not move on its own when a section is saved. Re-read after every write
 * — a progress bar that lies about progress is worse than none.
 */
async function refreshCompletion() {
  await auth.fetchMe().catch(() => undefined)
}

function open(kind: SectionKind, existing: ProfileSection | null = null) {
  store.error = ''
  editing.value = { kind, existing }
}

async function savePayload(
  payload: { text?: string; title?: string; items?: SectionItem[] },
  visibility: Visibility,
) {
  if (!editing.value) return

  const request: UpsertSectionPayload = { kind: editing.value.kind, visibility, payload }
  const ok = await store.save(request)

  if (ok) {
    editing.value = null
    await refreshCompletion()
  }
}

async function saveTags(type: TagType, tags: TagItem[]) {
  const ok = await store.saveTags(type, tags)
  if (ok) {
    editing.value = null
    await refreshCompletion()
  }
}

async function saveInterests(ids: number[]) {
  const ok = await store.saveInterests(ids)
  if (ok) {
    editing.value = null
    await refreshCompletion()
  }
}

async function saveLinks(links: SocialLink[]) {
  const ok = await store.saveSocialLinks(links)
  if (ok) {
    editing.value = null
    await refreshCompletion()
  }
}

async function remove() {
  if (!editing.value?.existing) return
  await store.remove(editing.value.existing)
  editing.value = null
  await refreshCompletion()
}

onMounted(async () => {
  await store.fetch()
  // The completion meter is served beside /me, so it has to be re-read rather
  // than derived from the sections we just loaded.
  await auth.fetchMe().catch(() => undefined)
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl pb-10">
      <div class="flex items-center justify-between gap-3 mb-5">
        <h1 class="text-xl font-bold text-ink">Profilni to'ldirish</h1>
        <RouterLink to="/profile" class="text-sm text-primary-600 font-medium">Profilim</RouterLink>
      </div>

      <!-- Identity first: the handle is the one field on this screen other
           people type, cite and link to. It reads from the auth store rather
           than the sections store, so it stays put through the loading and
           error states below. -->
      <UsernameEditor />

      <!-- Completion -->
      <AppCard v-if="completion" class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-ink">Profil to'liqligi</span>
          <span class="text-sm font-bold text-primary-600">{{ completion.percent }}%</span>
        </div>
        <div class="h-2 rounded-full bg-surface-muted overflow-hidden">
          <div
            class="h-full rounded-full bg-primary-500 transition-all duration-500"
            :style="{ width: `${completion.percent}%` }"
          />
        </div>
        <div v-if="completion.missing.length" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="item in completion.missing"
            :key="item.key"
            type="button"
            class="px-3 h-8 rounded-full border border-dashed border-border text-xs text-ink-muted hover:border-primary-300 hover:text-primary-700 transition-colors"
            @click="ADDABLE_KINDS.includes(item.key as SectionKind) && open(item.key as SectionKind)"
          >
            + {{ item.label }}
          </button>
        </div>
      </AppCard>

      <div v-if="store.loading && !store.loaded" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="70%" />
        </div>
      </div>

      <ErrorState v-else-if="!store.loaded && store.error" @retry="store.fetch()" />

      <template v-else>
        <ProfileSections
          :sections="store.sections"
          editable
          @edit="(section) => open(section.kind, section)"
        />

        <!-- Empty profile: an invitation, not a blank page. -->
        <AppCard v-if="!store.sections.length" class="text-center py-8">
          <span
            class="w-12 h-12 rounded-2xl bg-surface-muted text-ink-faint flex items-center justify-center mx-auto mb-3"
          >
            <FontAwesomeIcon :icon="icons.profile" />
          </span>
          <p class="font-semibold text-ink">Profilingiz hali bo'sh</p>
          <p class="text-sm text-ink-muted mt-1">
            Quyidan bo'lim qo'shing — odamlar sizni shu orqali taniydi.
          </p>
        </AppCard>

        <h2 class="font-semibold text-ink mt-6 mb-3">Bo'lim qo'shish</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="kind in addable"
            :key="kind"
            type="button"
            class="inline-flex items-center gap-2 px-3 h-10 rounded-xl border border-border text-sm text-ink-secondary hover:border-primary-300 hover:text-primary-700 transition-colors"
            @click="open(kind)"
          >
            <FontAwesomeIcon
              v-if="sectionPresentation(kind)"
              :icon="sectionPresentation(kind)!.icon"
              class="text-ink-faint text-xs"
            />
            {{ sectionPresentation(kind)?.labelKey ?? kind }}
          </button>
        </div>
      </template>
    </div>

    <SectionEditor
      v-if="editing"
      :kind="editing.kind"
      :existing="editing.existing"
      :saving="store.saving"
      :error="store.error"
      @close="editing = null"
      @save-payload="savePayload"
      @save-tags="saveTags"
      @save-interests="saveInterests"
      @save-links="saveLinks"
      @remove="remove"
    />
  </AppLayout>
</template>
