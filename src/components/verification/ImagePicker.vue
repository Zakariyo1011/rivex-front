<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { icons } from '@/lib/icons'

const props = withDefaults(
  defineProps<{
    modelValue: File | null
    label: string
    hint?: string
    /**
     * `environment` = rear camera (documents), `user` = front camera (selfie),
     * `null` = no camera hint, so the OS offers the gallery first. A cover
     * photo is usually one the organiser already has.
     */
    capture?: 'environment' | 'user' | null
    /**
     * MIME types this particular upload accepts, defaulting to the KYC set.
     *
     * Passed in rather than fixed because the two endpoints behind this
     * component genuinely differ: identity documents take HEIC at 8 MB,
     * activity covers take four web formats at 4 MB. Hard-coding the looser
     * pair here would let somebody pick a photo the server then refuses, which
     * is the failure this component exists to prevent.
     */
    acceptedTypes?: string[]
    maxBytes?: number
    /** What the empty state offers to do. */
    emptyLabel?: string
  }>(),
  {
    capture: 'environment',
    acceptedTypes: () => ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    maxBytes: 8 * 1024 * 1024,
    emptyLabel: 'Rasm tanlash',
  },
)

const emit = defineEmits<{ 'update:modelValue': [file: File | null] }>()

/** Mirrors the backend rules so the user hears about a bad file immediately. */
const acceptAttribute = computed(() => props.acceptedTypes.join(','))
const maxLabel = computed(() => `${Math.round(props.maxBytes / 1024 / 1024)} MB`)

const input = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)
const error = ref('')

const sizeLabel = computed(() =>
  props.modelValue ? `${(props.modelValue.size / 1024 / 1024).toFixed(1)} MB` : '',
)

function releasePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

watch(
  () => props.modelValue,
  (file) => {
    releasePreview()
    // HEIC has no browser-renderable preview; the card falls back to a filename.
    if (file && file.type.startsWith('image/') && !file.type.includes('hei')) {
      previewUrl.value = URL.createObjectURL(file)
    }
  },
  { immediate: true },
)

onBeforeUnmount(releasePreview)

function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''

  if (!file) return

  if (!props.acceptedTypes.includes(file.type)) {
    error.value = `Bu format qo'llab-quvvatlanmaydi. Ruxsat etilgan: ${props.acceptedTypes
      .map((type) => type.replace('image/', '').toUpperCase())
      .join(', ')}.`
    clear()
    return
  }

  if (file.size > props.maxBytes) {
    error.value = `Rasm hajmi ${maxLabel.value} dan katta bo'lmasligi kerak.`
    clear()
    return
  }

  emit('update:modelValue', file)
}

function clear() {
  emit('update:modelValue', null)
  if (input.value) input.value.value = ''
}
</script>

<template>
  <div>
    <p class="text-sm font-medium text-ink-secondary mb-2">{{ label }}</p>

    <div v-if="modelValue" class="rounded-2xl border border-border bg-surface overflow-hidden">
      <div class="aspect-[4/3] bg-surface-muted flex items-center justify-center">
        <img v-if="previewUrl" :src="previewUrl" :alt="label" class="w-full h-full object-contain" />
        <div v-else class="text-center text-ink-faint px-4">
          <FontAwesomeIcon :icon="icons.image" class="text-2xl mb-2" />
          <p class="text-sm break-all">{{ modelValue.name }}</p>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
        <span class="text-xs text-ink-faint truncate">{{ modelValue.name }} · {{ sizeLabel }}</span>
        <span class="flex items-center gap-3 shrink-0">
          <button type="button" class="text-sm font-medium text-primary-600" @click="input?.click()">
            O'zgartirish
          </button>
          <button type="button" class="text-sm font-medium text-ink-muted hover:text-danger" @click="clear">
            O'chirish
          </button>
        </span>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="w-full rounded-2xl border-2 border-dashed border-primary-200 bg-surface hover:border-primary-400 hover:bg-primary-50 transition px-4 py-10 flex flex-col items-center gap-2 text-center"
      @click="input?.click()"
    >
      <span class="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-lg">
        <!-- The glyph follows what is being asked for: a selfie, a document,
             or (no camera hint) an image the person already has. -->
        <FontAwesomeIcon
          :icon="capture === 'user' ? icons.camera : capture === null ? icons.image : icons.identity"
        />
      </span>
      <span class="text-[15px] font-medium text-ink">{{ emptyLabel }}</span>
      <span v-if="hint" class="text-xs text-ink-faint max-w-xs">{{ hint }}</span>
    </button>

    <input
      ref="input"
      type="file"
      :accept="acceptAttribute"
      :capture="capture ?? undefined"
      class="sr-only"
      @change="onPick"
    />

    <p v-if="error" class="text-sm text-danger mt-2">{{ error }}</p>
  </div>
</template>
