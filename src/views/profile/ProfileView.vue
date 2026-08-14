<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/auth'
import { profileApi } from '@/api/profile'
import { locationsApi } from '@/api/locations'
import { extractErrorMessage } from '@/composables/useApiError'
import type { District, Region } from '@/types'

const auth = useAuthStore()

const editing = ref(false)
const saving = ref(false)
const error = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)

const editingLocation = ref(false)
const savingLocation = ref(false)
const locationError = ref('')
const regions = ref<Region[]>([])
const districts = ref<District[]>([])
const regionId = ref<number | null>(null)
const districtId = ref<number | null>(null)
const currentRegionName = ref<string | null>(null)
const currentDistrictName = ref<string | null>(null)

const form = reactive({
  name: auth.user?.name ?? '',
  bio: auth.user?.profile.bio ?? '',
  age: auth.user?.profile.age ?? '',
  location_name: auth.user?.profile.location_name ?? '',
})

function onAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    const user = await profileApi.update({
      name: form.name,
      bio: form.bio,
      age: form.age ? Number(form.age) : undefined,
      location_name: form.location_name,
      avatar: avatarFile.value ?? undefined,
    })
    auth.user = user.data.data
    editing.value = false
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    saving.value = false
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

async function startEditLocation() {
  editingLocation.value = true
  if (regions.value.length === 0) {
    const { data } = await locationsApi.regions()
    regions.value = data.data
  }
  if (regionId.value) await loadDistricts(regionId.value)
}

async function saveLocation() {
  locationError.value = ''
  savingLocation.value = true
  try {
    const { data } = await locationsApi.updateMe({
      region_id: regionId.value,
      district_id: districtId.value ?? undefined,
    })
    currentRegionName.value = data.data.region?.name ?? null
    currentDistrictName.value = data.data.district?.name ?? null
    editingLocation.value = false
  } catch (e) {
    locationError.value = extractErrorMessage(e)
  } finally {
    savingLocation.value = false
  }
}

onMounted(async () => {
  await auth.fetchMe()

  const { data } = await locationsApi.me()
  regionId.value = data.data.region?.id ?? null
  districtId.value = data.data.district?.id ?? null
  currentRegionName.value = data.data.region?.name ?? null
  currentDistrictName.value = data.data.district?.name ?? null
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="card p-6 text-center">
        <label class="relative inline-block cursor-pointer">
          <div class="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold overflow-hidden mx-auto">
            <img
              v-if="avatarPreview || auth.user?.profile.avatar_url"
              :src="avatarPreview ?? auth.user?.profile.avatar_url!"
              class="w-full h-full object-cover"
            />
            <span v-else>{{ auth.user?.display_name?.[0] }}</span>
          </div>
          <span
            v-if="editing"
            class="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs"
          >
            <FontAwesomeIcon :icon="icons.edit" />
          </span>
          <input v-if="editing" type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
        </label>

        <h1 class="text-lg font-bold text-ink mt-3 flex items-center justify-center gap-1.5">
          {{ auth.user?.display_name }}
          <FontAwesomeIcon v-if="auth.user?.identity_verified" :icon="icons.verified" class="text-primary-500 text-sm" />
        </h1>

        <!-- Editing a handle you already hold is not onboarding. That route
             renders the auth layout with no navigation, starts from an empty
             field, and on success pushes into the interests step — so an
             established user who only wanted to fix a typo ended up being
             walked through sign-up again. -->
        <RouterLink
          v-if="auth.user?.username"
          to="/profile/edit"
          class="text-sm text-ink-faint hover:text-primary-600 transition-colors"
        >
          @{{ auth.user.username }}
        </RouterLink>

        <p class="text-sm text-ink-muted">{{ auth.user?.phone }}</p>

        <!-- Your own counts are always yours to see; `who_can_see_followers`
             governs who else may, never the account holder. The request badge
             is a to-do, so it only appears when there is something to do. -->
        <div
          v-if="auth.followCounts && auth.user"
          class="flex items-center justify-center gap-5 mt-3 text-sm"
        >
          <RouterLink
            :to="{ name: 'follow-list', params: { id: String(auth.user.id), tab: 'followers' } }"
            class="hover:text-primary-600 transition-colors"
          >
            <span class="font-bold text-ink">{{ auth.followCounts.followers }}</span>
            <span class="text-ink-muted ml-1">kuzatuvchi</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'follow-list', params: { id: String(auth.user.id), tab: 'following' } }"
            class="hover:text-primary-600 transition-colors"
          >
            <span class="font-bold text-ink">{{ auth.followCounts.following }}</span>
            <span class="text-ink-muted ml-1">kuzatilmoqda</span>
          </RouterLink>
        </div>

        <RouterLink
          v-if="auth.followCounts?.pending_requests && auth.user"
          :to="{ name: 'follow-list', params: { id: String(auth.user.id), tab: 'requests' } }"
          class="inline-flex items-center gap-1.5 mt-3 px-3 h-8 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
        >
          <FontAwesomeIcon :icon="icons.people" />
          {{ auth.followCounts.pending_requests }} ta kuzatuv so'rovi
        </RouterLink>

        <!-- Completion, owner-only. Doubles as the way into the section editor. -->
        <RouterLink
          v-if="auth.completion && auth.completion.percent < 100"
          to="/profile/edit"
          class="block mt-4 pt-4 border-t border-border text-left"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-medium text-ink-secondary">Profil to'liqligi</span>
            <span class="text-xs font-bold text-primary-600">{{ auth.completion.percent }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-surface-muted overflow-hidden">
            <div
              class="h-full rounded-full bg-primary-500 transition-all duration-500"
              :style="{ width: `${auth.completion.percent}%` }"
            />
          </div>
          <p class="text-xs text-ink-faint mt-1.5">Bo'lim qo'shish uchun bosing</p>
        </RouterLink>

        <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <p class="font-bold text-ink">{{ auth.user?.rating_average ?? '—' }}</p>
            <p class="text-xs text-ink-muted flex items-center justify-center gap-1">
              <FontAwesomeIcon :icon="icons.starSolid" class="text-star" /> Reyting
            </p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ auth.user?.completed_activities_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Yakunlangan</p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ auth.user?.reviews_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Sharhlar</p>
          </div>
        </div>

        <div
          v-if="auth.user?.trust_score !== undefined"
          class="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2"
        >
          <span class="text-sm text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.trust" /> Trust score
          </span>
          <span class="text-sm font-bold text-primary-600">{{ auth.user.trust_score }}%</span>
        </div>
      </div>

      <div class="card p-5 mt-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-ink">Profil ma'lumotlari</h2>
          <button class="text-sm text-primary-600 font-medium" @click="editing = !editing">
            {{ editing ? 'Bekor qilish' : "Tahrirlash" }}
          </button>
        </div>

        <div v-if="editing" class="space-y-4">
          <AppInput v-model="form.name" label="Ism" />
          <label class="block">
            <span class="block text-sm font-medium text-ink-secondary mb-1.5">Bio</span>
            <textarea
              v-model="form.bio"
              rows="3"
              class="w-full rounded-xl border border-border p-3 text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <AppInput v-model.number="form.age" label="Yosh" type="number" />
          <AppInput v-model="form.location_name" label="Manzil" placeholder="Tashkent, Uzbekistan" />

          <p v-if="error" class="text-sm text-danger">{{ error }}</p>

          <AppButton :loading="saving" @click="save">Saqlash</AppButton>
        </div>

        <div v-else class="space-y-2 text-sm">
          <p v-if="auth.user?.profile.bio" class="text-ink-secondary">{{ auth.user.profile.bio }}</p>
          <p v-if="auth.user?.profile.location_name" class="text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.location" class="text-ink-faint text-xs" /> {{ auth.user.profile.location_name }}
          </p>
          <p v-if="auth.user?.profile.age" class="text-ink-muted">{{ auth.user.profile.age }} yosh</p>
        </div>
      </div>

      <div class="card p-5 mt-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-ink">Joylashuv</h2>
          <button class="text-sm text-primary-600 font-medium" @click="editingLocation ? (editingLocation = false) : startEditLocation()">
            {{ editingLocation ? 'Bekor qilish' : "Tahrirlash" }}
          </button>
        </div>

        <div v-if="editingLocation" class="space-y-4">
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

          <AppButton :loading="savingLocation" @click="saveLocation">Saqlash</AppButton>
        </div>

        <div v-else class="text-sm">
          <p v-if="currentRegionName" class="text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.location" class="text-ink-faint text-xs" />
            {{ currentRegionName }}<span v-if="currentDistrictName">, {{ currentDistrictName }}</span>
          </p>
          <p v-else class="text-ink-faint">Joylashuv tanlanmagan</p>
        </div>
      </div>

      <div class="mt-4">
        <RouterLink to="/settings" class="card card-hover p-4 flex items-center justify-between">
          <span class="font-medium text-ink flex items-center gap-2.5">
            <FontAwesomeIcon :icon="icons.settings" class="text-ink-faint w-4" />
            Sozlamalar
          </span>
          <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs" />
        </RouterLink>
      </div>
    </div>
  </AppLayout>
</template>
