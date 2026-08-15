<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import ProfileSections from '@/components/profile/ProfileSections.vue'
import SectionEditor from '@/components/profile/SectionEditor.vue'
import UsernameEditor from '@/components/profile/UsernameEditor.vue'
import { useProfileSectionsStore } from '@/stores/profileSections'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useHashScroll } from '@/composables/useHashScroll'
import { extractErrorMessage } from '@/composables/useApiError'
import { profileApi } from '@/api/profile'
import { locationsApi } from '@/api/locations'
import type { District, Region } from '@/types'
import { ADDABLE_KINDS, sectionPresentation } from '@/lib/profileSections'
import { icons } from '@/lib/icons'
import type { ProfileSection, SectionItem, SectionKind, SocialLink, TagItem, TagType, UpsertSectionPayload } from '@/api/sections'
import type { Visibility } from '@/api/privacy'

const store = useProfileSectionsStore()
const auth = useAuthStore()
const toast = useToast()
const { scrollToHash } = useHashScroll()

/**
 * The basic profile fields.
 *
 * These lived as an inline `editing` toggle on the profile *display* page,
 * while this screen — the one called "edit" — held only the handle and the
 * section list. The two were swapped; this is the correction. Nothing about the
 * endpoint changed: it is the same `PUT /me/profile` that was already there.
 */
const basics = reactive({
  name: '',
  bio: '',
  age: '' as number | string,
  location_name: '',
})

const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const savingBasics = ref(false)
const basicsError = ref('')

const regions = ref<Region[]>([])
const districts = ref<District[]>([])
const regionId = ref<number | null>(null)
const districtId = ref<number | null>(null)
const savingLocation = ref(false)
const locationError = ref('')

function fillBasics() {
  basics.name = auth.user?.name ?? ''
  basics.bio = auth.user?.profile.bio ?? ''
  basics.age = auth.user?.profile.age ?? ''
  basics.location_name = auth.user?.profile.location_name ?? ''
}

function onAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function saveBasics() {
  basicsError.value = ''
  savingBasics.value = true

  try {
    const { data } = await profileApi.update({
      name: basics.name,
      bio: basics.bio,
      age: basics.age ? Number(basics.age) : undefined,
      location_name: basics.location_name,
      avatar: avatarFile.value ?? undefined,
    })

    auth.user = data.data
    avatarFile.value = null
    avatarPreview.value = null
    toast.success('Saqlandi')
    await refreshCompletion()
  } catch (e) {
    basicsError.value = extractErrorMessage(e)
  } finally {
    savingBasics.value = false
  }
}

async function loadDistricts(id: number) {
  const { data } = await locationsApi.districts(id)
  districts.value = data.data
}

async function onRegionChange() {
  districtId.value = null
  if (regionId.value) await loadDistricts(regionId.value)
}

async function saveLocation() {
  locationError.value = ''
  savingLocation.value = true

  try {
    await locationsApi.updateMe({
      region_id: regionId.value,
      district_id: districtId.value ?? undefined,
    })
    toast.success('Joylashuv saqlandi')
    await refreshCompletion()
  } catch (e) {
    locationError.value = extractErrorMessage(e)
  } finally {
    savingLocation.value = false
  }
}

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
  fillBasics()

  try {
    const [me, regionList] = await Promise.all([locationsApi.me(), locationsApi.regions()])

    regions.value = regionList.data.data
    regionId.value = me.data.data.region?.id ?? null
    districtId.value = me.data.data.district?.id ?? null

    if (regionId.value) await loadDistricts(regionId.value)
  } catch {
    regions.value = []
  }

  // Settings → Account → "Foydalanuvchi nomi" links to #username, and the card
  // only exists now that the data behind this screen has arrived.
  void scrollToHash()
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl pb-10">
      <div class="flex items-center justify-between gap-3 mb-5">
        <h1 class="text-xl font-bold text-ink">Profilni tahrirlash</h1>
        <RouterLink to="/profile" class="text-sm text-primary-600 font-medium">Profilim</RouterLink>
      </div>

      <!-- Who you are: face, name, and the words underneath them. First
           because it is what another person sees first. -->
      <AppCard class="mb-4">
        <h2 class="font-semibold text-ink mb-4">Asosiy ma'lumotlar</h2>

        <div class="flex items-center gap-4 mb-5">
          <label class="relative cursor-pointer shrink-0">
            <div
              class="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold overflow-hidden"
            >
              <img
                v-if="avatarPreview || auth.user?.profile.avatar_url"
                :src="avatarPreview ?? auth.user?.profile.avatar_url!"
                class="w-full h-full object-cover"
                alt=""
              />
              <span v-else>{{ auth.user?.display_name?.[0] }}</span>
            </div>
            <span
              class="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs border-2 border-surface"
            >
              <FontAwesomeIcon :icon="icons.camera" />
            </span>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              aria-label="Rasm tanlash"
              @change="onAvatarChange"
            />
          </label>

          <div class="text-sm text-ink-muted">
            <p class="font-medium text-ink-secondary">Profil rasmi</p>
            <p class="text-xs mt-0.5">Rasmni almashtirish uchun bosing.</p>
          </div>
        </div>

        <div class="space-y-4">
          <AppInput v-model="basics.name" label="Ism" />

          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Bio</span>
            <textarea
              v-model="basics.bio"
              rows="3"
              placeholder="O'zingiz haqingizda qisqacha"
              class="w-full rounded-xl border border-border bg-surface p-3 text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <AppInput v-model.number="basics.age" label="Yosh" type="number" />
          <AppInput
            v-model="basics.location_name"
            label="Manzil"
            placeholder="Toshkent, Chilonzor"
          />

          <p v-if="basicsError" class="text-sm text-danger">{{ basicsError }}</p>

          <AppButton :loading="savingBasics" @click="saveBasics">Saqlash</AppButton>
        </div>
      </AppCard>

      <!-- The handle. Its own card, on the edit screen, rather than something
           you reach by tapping your own name on the profile page. The rules
           behind it — cooldown, quarantine, availability — are unchanged and
           still live entirely in UsernameService. -->
      <UsernameEditor />

      <!-- Region and district: structured location, separate from the free-text
           `location_name` above because search filters on this one. -->
      <AppCard class="mb-4">
        <h2 class="font-semibold text-ink mb-4">Joylashuv</h2>

        <div class="space-y-4">
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Viloyat</span>
            <select
              v-model.number="regionId"
              class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
              @change="onRegionChange"
            >
              <option :value="null" disabled>Viloyatni tanlang</option>
              <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </label>

          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Tuman</span>
            <select
              v-model.number="districtId"
              :disabled="!regionId"
              class="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px] outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-surface-muted disabled:text-ink-faint"
            >
              <option :value="null">Tuman tanlanmagan</option>
              <option v-for="d in districts" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </label>

          <p v-if="locationError" class="text-sm text-danger">{{ locationError }}</p>

          <AppButton variant="outline" :loading="savingLocation" @click="saveLocation">
            Joylashuvni saqlash
          </AppButton>
        </div>
      </AppCard>

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
