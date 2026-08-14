<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import InterestPicker from '@/components/profile/InterestPicker.vue'
import { sectionPresentation } from '@/lib/profileSections'
import { sectionsApi, type ProfileSection, type SectionItem, type SectionKind, type SocialLink, type TagItem, type TagType } from '@/api/sections'
import { interestsApi } from '@/api/interests'
import { icons } from '@/lib/icons'
import type { Visibility } from '@/api/privacy'

const props = defineProps<{
  kind: SectionKind
  existing?: ProfileSection | null
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  savePayload: [payload: { text?: string; title?: string; items?: SectionItem[] }, visibility: Visibility]
  saveTags: [type: TagType, tags: TagItem[]]
  saveLinks: [links: SocialLink[]]
  saveInterests: [ids: number[]]
  remove: []
}>()

const presentation = computed(() => sectionPresentation(props.kind))
const form = computed(() => presentation.value?.form ?? 'list')

const VISIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Hamma' },
  { value: 'followers', label: 'Kuzatuvchilar' },
  { value: 'only_me', label: 'Faqat men' },
]

const TAG_TYPE: Partial<Record<SectionKind, TagType>> = {
  skills: 'skill',
  hobbies: 'hobby',
  languages: 'language',
}

const LEVELS = [
  { value: '', label: 'Daraja' },
  { value: 'native', label: 'Ona tili' },
  { value: 'fluent', label: 'Erkin' },
  { value: 'intermediate', label: "O'rta" },
  { value: 'basic', label: 'Boshlang\'ich' },
]

/**
 * A row while it is being edited.
 *
 * The payload is a JSON column on the server and the fields differ per
 * section, so the editor genuinely works with dynamic keys. Declaring that
 * honestly is better than casting `SectionItem` at every use.
 */
type EditableItem = { title: string } & Record<string, string | number | boolean | undefined>

/** Bridge the dynamic record to AppInput, which wants a string or a number. */
function fieldValue(item: EditableItem, key: string): string | number {
  const value = item[key]
  return typeof value === 'boolean' ? String(value) : (value ?? '')
}

function setField(item: EditableItem, key: string, value: string | number) {
  item[key] = value
}

const state = reactive({
  text: '',
  title: '',
  visibility: 'everyone' as Visibility,
  items: [] as EditableItem[],
  tags: [] as TagItem[],
  interests: [] as number[],
  links: [] as SocialLink[],
})

const tagInput = ref('')
const suggestions = ref<TagItem[]>([])
const platforms = ref<{ value: string; label: string; is_handle: boolean }[]>([])

watch(
  () => [props.kind, props.existing] as const,
  async () => {
    const existing = props.existing

    state.text = existing?.text ?? ''
    state.title = props.kind === 'custom' ? (existing?.title ?? '') : ''
    state.visibility = existing?.visibility ?? (props.kind === 'social_links' ? 'followers' : 'everyone')
    state.items = existing && form.value !== 'tags' && form.value !== 'links'
      ? existing.items.map((item) => ({ ...item }) as EditableItem)
      : []
    state.tags = existing && form.value === 'tags' ? existing.items.map((i) => ({ name: i.title, level: i.level ?? null })) : []

    if (form.value === 'links') {
      const { data } = await sectionsApi.socialLinks()
      platforms.value = data.platforms
      state.links = data.data.map((l) => ({ ...l }))
    }

    if (form.value === 'tags') {
      await loadSuggestions('')
    }

    if (form.value === 'interests') {
      // Read from the server rather than from the section items: the section
      // carries names for display, and the picker works in ids.
      const { data } = await interestsApi.mine()
      state.interests = data.data.map((interest) => interest.id)
    }
  },
  { immediate: true },
)

async function loadSuggestions(q: string) {
  const type = TAG_TYPE[props.kind]
  if (!type) return
  try {
    const { data } = await sectionsApi.tagSuggestions(type, q)
    suggestions.value = data.data
  } catch {
    suggestions.value = []
  }
}

function addItem() {
  state.items.push({ title: '' })
}

function addTag(name: string) {
  const clean = name.trim()
  if (!clean) return
  if (state.tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) return
  state.tags.push({ name: clean, level: null })
  tagInput.value = ''
}

function addLink(platform: string) {
  if (state.links.some((l) => l.platform === platform)) return
  state.links.push({ platform, value: '' })
}

/** Blank rows are the natural result of an "add" button; they are not data. */
function submit() {
  if (form.value === 'interests') {
    emit('saveInterests', state.interests)
    return
  }

  if (form.value === 'tags') {
    const type = TAG_TYPE[props.kind]
    if (type) emit('saveTags', type, state.tags)
    return
  }

  if (form.value === 'links') {
    emit('saveLinks', state.links.filter((l) => l.value.trim() !== ''))
    return
  }

  if (form.value === 'text') {
    emit('savePayload', { text: state.text.trim() }, state.visibility)
    return
  }

  const items: SectionItem[] = state.items
    .filter((item) => item.title.trim() !== '')
    .map((item) => {
      const clean: SectionItem = { title: item.title.trim() }

      for (const field of presentation.value?.fields ?? []) {
        const value = item[field.key]
        if (value === undefined || value === '') continue
        clean[field.key] = field.type === 'number' ? Number(value) : value
      }

      const note = String(item.note ?? '').trim()
      if (note !== '') clean.note = note

      return clean
    })

  emit('savePayload', props.kind === 'custom' ? { title: state.title.trim(), items } : { items }, state.visibility)
}
</script>

<template>
  <AppModal :title="presentation?.labelKey ?? 'Bo\'lim'" @close="$emit('close')">
    <div class="space-y-4">
      <p v-if="error" class="rounded-xl bg-danger-bg text-danger text-sm px-3 py-2" role="alert">
        {{ error }}
      </p>

      <AppInput v-if="kind === 'custom'" v-model="state.title" label="Bo'lim nomi" placeholder="Masalan: Mushuklarim" />

      <!-- Free text -->
      <AppTextarea
        v-if="form === 'text'"
        v-model="state.text"
        label="Matn"
        :rows="5"
        :placeholder="presentation?.placeholder"
      />

      <!-- Tags -->
      <div v-else-if="form === 'tags'" class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(tag, index) in state.tags"
            :key="tag.name"
            class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1.5"
          >
            {{ tag.name }}
            <select
              v-if="kind === 'languages'"
              v-model="tag.level"
              class="bg-transparent text-[11px] outline-none"
            >
              <option v-for="level in LEVELS" :key="level.value" :value="level.value || null">
                {{ level.label }}
              </option>
            </select>
            <button type="button" aria-label="Olib tashlash" @click="state.tags.splice(index, 1)">
              <FontAwesomeIcon :icon="icons.close" class="text-[0.65rem]" />
            </button>
          </span>
        </div>

        <AppInput
          v-if="kind !== 'languages'"
          v-model="tagInput"
          label="Qo'shish"
          placeholder="Yozing va Enter bosing"
          @keydown.enter.prevent="addTag(tagInput)"
          @update:model-value="loadSuggestions(String($event))"
        />

        <div v-if="suggestions.length" class="flex flex-wrap gap-2">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion.slug ?? suggestion.name"
            type="button"
            class="px-3 h-8 rounded-full border border-border text-xs text-ink-secondary hover:border-primary-300 hover:text-primary-700 transition-colors"
            @click="addTag(suggestion.name)"
          >
            {{ suggestion.name }}
          </button>
        </div>
      </div>

      <!-- Interests: a closed vocabulary, so a picker rather than a text field -->
      <InterestPicker
        v-else-if="form === 'interests'"
        :selected="state.interests"
        @update:selected="state.interests = $event"
      />

      <!-- Social links -->
      <div v-else-if="form === 'links'" class="space-y-3">
        <div v-for="(link, index) in state.links" :key="link.platform" class="flex items-end gap-2">
          <AppInput
            v-model="link.value"
            :label="platforms.find((p) => p.value === link.platform)?.label ?? link.platform"
            class="flex-1"
            placeholder="foydalanuvchi nomi"
          />
          <button
            type="button"
            class="h-12 px-3 text-ink-faint hover:text-danger"
            aria-label="Olib tashlash"
            @click="state.links.splice(index, 1)"
          >
            <FontAwesomeIcon :icon="icons.close" />
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="platform in platforms.filter((p) => !state.links.some((l) => l.platform === p.value))"
            :key="platform.value"
            type="button"
            class="px-3 h-8 rounded-full border border-border text-xs text-ink-secondary hover:border-primary-300 transition-colors"
            @click="addLink(platform.value)"
          >
            + {{ platform.label }}
          </button>
        </div>
      </div>

      <!-- Lists and timelines -->
      <div v-else class="space-y-3">
        <div
          v-for="(item, index) in state.items"
          :key="index"
          class="rounded-xl border border-border p-3 space-y-2.5"
        >
          <div class="flex items-start gap-2">
            <AppInput v-model="item.title" label="Nomi" class="flex-1" />
            <button
              type="button"
              class="h-12 px-2 text-ink-faint hover:text-danger"
              aria-label="Olib tashlash"
              @click="state.items.splice(index, 1)"
            >
              <FontAwesomeIcon :icon="icons.close" />
            </button>
          </div>

          <div v-if="presentation?.fields?.length" class="grid grid-cols-2 gap-2">
            <AppInput
              v-for="field in presentation.fields"
              :key="field.key"
              :model-value="fieldValue(item, field.key)"
              :label="field.label"
              :type="field.type ?? 'text'"
              @update:model-value="setField(item, field.key, $event)"
            />
          </div>

          <AppInput
            :model-value="fieldValue(item, 'note')"
            label="Izoh (ixtiyoriy)"
            @update:model-value="setField(item, 'note', $event)"
          />
        </div>

        <button
          type="button"
          class="w-full h-11 rounded-xl border border-dashed border-border text-sm text-ink-muted hover:border-primary-300 hover:text-primary-700 transition-colors"
          @click="addItem"
        >
          + Qo'shish
        </button>
      </div>

      <!-- Per-section audience. Tag- and link-backed sections carry their own
           row, so the control is shown for every kind. -->
      <AppSelect
        v-if="form !== 'tags' && form !== 'links' && form !== 'interests'"
        v-model="state.visibility"
        label="Kim ko'radi"
        :options="VISIBILITY_OPTIONS"
      />
    </div>

    <div class="flex items-center gap-2 mt-5 pt-4 border-t border-border">
      <AppButton v-if="existing" variant="outline" :disabled="saving" @click="$emit('remove')">
        O'chirish
      </AppButton>
      <AppButton class="flex-1" :loading="saving" @click="submit">Saqlash</AppButton>
    </div>
  </AppModal>
</template>
