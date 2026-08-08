<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useAuthStore } from '@/stores/auth'
import { profileApi } from '@/api/profile'
import { extractErrorMessage } from '@/composables/useApiError'

const router = useRouter()
const auth = useAuthStore()

const editing = ref(false)
const saving = ref(false)
const error = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)

const form = reactive({
  name: auth.user?.name ?? '',
  bio: auth.user?.profile.bio ?? '',
  age: auth.user?.profile.age ?? undefined,
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

async function logout() {
  await auth.logout()
  router.push({ name: 'welcome' })
}

onMounted(async () => {
  await auth.fetchMe()
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
            <span v-else>{{ auth.user?.name?.[0] }}</span>
          </div>
          <span
            v-if="editing"
            class="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs"
            >✎</span
          >
          <input v-if="editing" type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
        </label>

        <h1 class="text-lg font-bold text-ink mt-3 flex items-center justify-center gap-1.5">
          {{ auth.user?.name }}
          <span v-if="auth.user?.identity_verified" class="text-primary-500 text-sm">✓</span>
        </h1>
        <p class="text-sm text-ink-muted">{{ auth.user?.phone }}</p>

        <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <p class="font-bold text-ink">{{ auth.user?.rating_average ?? '—' }}</p>
            <p class="text-xs text-ink-muted">⭐ Reyting</p>
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
          <p v-if="auth.user?.profile.location_name" class="text-ink-muted">📍 {{ auth.user.profile.location_name }}</p>
          <p v-if="auth.user?.profile.age" class="text-ink-muted">{{ auth.user.profile.age }} yosh</p>
        </div>
      </div>

      <div class="mt-4 space-y-2">
        <RouterLink to="/wallet" class="card p-4 flex items-center justify-between">
          <span class="font-medium text-ink">💳 Hamyon</span>
          <span class="text-ink-faint">›</span>
        </RouterLink>
        <RouterLink to="/blocked-users" class="card p-4 flex items-center justify-between">
          <span class="font-medium text-ink">🚫 Bloklangan foydalanuvchilar</span>
          <span class="text-ink-faint">›</span>
        </RouterLink>
      </div>

      <AppButton variant="ghost" class="mt-6" @click="logout">Chiqish</AppButton>
    </div>
  </AppLayout>
</template>
