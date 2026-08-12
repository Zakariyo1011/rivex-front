<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { adminAccountsApi } from '@/api/admin'
import { useAdminStore } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/datetime'
import type { AdminAccount, AdminRole, AdminRoleOption } from '@/types'

/**
 * Admin account management. Reachable only with `admins.manage`.
 *
 * Nothing here decides authorisation — the server refuses every one of these
 * calls without the permission. The screen's job is to make the consequences
 * legible: which role grants what, and why disabling is usually the right
 * action rather than deleting.
 */
const store = useAdminStore()
const toast = useToast()

const admins = ref<AdminAccount[]>([])
const roles = ref<AdminRoleOption[]>([])
const loading = ref(true)
const hasError = ref(false)
const page = ref(1)
const lastPage = ref(1)
const search = ref('')
const roleFilter = ref('')

const showForm = ref(false)
const editing = ref<AdminAccount | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'moderator' as AdminRole,
})

const resetting = ref<AdminAccount | null>(null)
const resetForm = ref({ password: '', password_confirmation: '' })
const confirmingDelete = ref<AdminAccount | null>(null)

const roleOptions = computed(() => [
  { value: '', label: 'Barcha rollar' },
  ...roles.value.map((r) => ({ value: r.value, label: r.label })),
])

const formRoleOptions = computed(() => roles.value.map((r) => ({ value: r.value, label: r.label })))

const selectedRolePermissions = computed(
  () => roles.value.find((r) => r.value === form.value.role)?.permissions ?? [],
)

/** The signed-in admin, so the UI can explain why some actions are absent. */
const isSelf = (admin: AdminAccount) => admin.id === store.admin?.id

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminAccountsApi.list({
      page: page.value,
      q: search.value || undefined,
      role: roleFilter.value || undefined,
    })
    admins.value = data.data
    roles.value = data.meta.roles
    lastPage.value = data.meta.last_page
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'moderator',
  }
  formError.value = ''
  showForm.value = true
}

function openEdit(admin: AdminAccount) {
  editing.value = admin
  form.value = {
    name: admin.name,
    email: admin.email,
    password: '',
    password_confirmation: '',
    role: admin.role,
  }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  saving.value = true

  try {
    if (editing.value) {
      await adminAccountsApi.update(editing.value.id, {
        name: form.value.name,
        email: form.value.email,
        role: form.value.role,
      })
      toast.success('Admin yangilandi.')
    } else {
      await adminAccountsApi.create({
        name: form.value.name,
        email: form.value.email,
        password: form.value.password,
        password_confirmation: form.value.password_confirmation,
        role: form.value.role,
      })
      toast.success('Admin yaratildi.')
    }

    showForm.value = false
    await load()
  } catch (e) {
    formError.value = extractErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function toggleActive(admin: AdminAccount) {
  try {
    await adminAccountsApi.update(admin.id, { is_active: !admin.is_active })
    toast.success(admin.is_active ? "Hisob o'chirildi." : 'Hisob yoqildi.')
    await load()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  }
}

async function resetPassword() {
  if (!resetting.value) return

  saving.value = true
  try {
    await adminAccountsApi.resetPassword(resetting.value.id, resetForm.value)
    toast.success('Parol yangilandi va barcha seanslar yakunlandi.')
    resetting.value = null
    resetForm.value = { password: '', password_confirmation: '' }
    await load()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function revokeSessions(admin: AdminAccount) {
  try {
    const { data } = await adminAccountsApi.revokeSessions(admin.id)
    toast.success(data.message)
    await load()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  }
}

async function remove() {
  if (!confirmingDelete.value) return

  try {
    await adminAccountsApi.remove(confirmingDelete.value.id)
    toast.success("Admin hisobi o'chirildi.")
    confirmingDelete.value = null
    await load()
  } catch (e) {
    toast.error(extractErrorMessage(e))
    confirmingDelete.value = null
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})

watch([page, roleFilter], load)

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="p-5 md:p-8">
      <div class="flex items-center justify-between gap-3 mb-2">
        <h1 class="text-xl md:text-2xl font-bold text-ink">Adminlar</h1>
        <AppButton class="!w-auto px-4" :icon="icons.add" @click="openCreate">
          Admin qo'shish
        </AppButton>
      </div>
      <p class="text-sm text-ink-muted mb-5">
        Rol o'zgartirilganda yoki hisob o'chirilganda o'sha adminning barcha seanslari darhol
        yakunlanadi.
      </p>

      <div class="flex flex-col md:flex-row gap-3 mb-5">
        <AppSearchInput v-model="search" placeholder="Ism yoki email..." class="flex-1" />
        <AppSelect v-model="roleFilter" :options="roleOptions" class="md:w-56" />
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="text" width="55%" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <EmptyState v-else-if="admins.length === 0" :icon="icons.people" title="Admin topilmadi" />

      <div v-else class="space-y-3">
        <article
          v-for="admin in admins"
          :key="admin.id"
          class="card p-4"
          :class="{ 'opacity-60': !admin.is_active }"
        >
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div class="min-w-0">
              <p class="font-semibold text-ink flex items-center gap-2 flex-wrap">
                {{ admin.name }}
                <AppBadge v-if="isSelf(admin)" variant="primary">Siz</AppBadge>
                <AppBadge v-if="!admin.is_active" variant="danger">O'chirilgan</AppBadge>
              </p>
              <p class="text-sm text-ink-muted">{{ admin.email }}</p>
              <div class="flex items-center gap-3 mt-1 text-xs text-ink-faint flex-wrap">
                <span>{{ admin.role_label }}</span>
                <span>{{ admin.permissions.length }} ruxsat</span>
                <span v-if="admin.active_sessions !== undefined">
                  {{ admin.active_sessions }} faol seans
                </span>
                <span>{{ formatDateTime(admin.created_at) }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <button
                class="text-xs font-medium text-primary-600 hover:underline"
                @click="openEdit(admin)"
              >
                Tahrirlash
              </button>
              <button
                class="text-xs font-medium text-primary-600 hover:underline"
                @click="resetting = admin"
              >
                Parolni tiklash
              </button>
              <button
                v-if="(admin.active_sessions ?? 0) > 0"
                class="text-xs font-medium text-warning hover:underline"
                @click="revokeSessions(admin)"
              >
                Seanslarni yakunlash
              </button>
              <!-- Self-actions are absent rather than disabled: the server
                   refuses them, and an inert button invites a support ticket. -->
              <button
                v-if="!isSelf(admin)"
                class="text-xs font-medium text-ink-muted hover:underline"
                @click="toggleActive(admin)"
              >
                {{ admin.is_active ? "O'chirish" : 'Yoqish' }}
              </button>
              <button
                v-if="!isSelf(admin)"
                class="text-xs font-medium text-danger hover:underline"
                @click="confirmingDelete = admin"
              >
                Butunlay o'chirish
              </button>
            </div>
          </div>
        </article>

        <Pagination v-model:current-page="page" :last-page="lastPage" />
      </div>
    </div>

    <!-- Create / edit -->
    <AppModal
      v-if="showForm"
      :title="editing ? 'Adminni tahrirlash' : 'Yangi admin'"
      @close="showForm = false"
    >
      <div class="space-y-4">
        <AppInput v-model="form.name" label="Ism" />
        <AppInput v-model="form.email" label="Email" type="email" />

        <template v-if="!editing">
          <div>
            <AppInput v-model="form.password" label="Parol" type="password" />
            <p class="text-xs text-ink-faint mt-1.5">
              Kamida 12 belgi, harf, raqam va maxsus belgi.
            </p>
          </div>
          <AppInput
            v-model="form.password_confirmation"
            label="Parolni takrorlang"
            type="password"
          />
        </template>

        <div>
          <AppSelect v-model="form.role" label="Rol" :options="formRoleOptions" />
          <p class="text-xs text-ink-faint mt-1.5">
            Bu rol {{ selectedRolePermissions.length }} ta ruxsatga ega:
            {{ selectedRolePermissions.join(', ') }}
          </p>
        </div>

        <p v-if="formError" class="text-sm text-danger">{{ formError }}</p>

        <div class="flex gap-2">
          <AppButton variant="ghost" class="flex-1" @click="showForm = false">
            Bekor qilish
          </AppButton>
          <AppButton class="flex-1" :loading="saving" @click="save">Saqlash</AppButton>
        </div>
      </div>
    </AppModal>

    <!-- Password reset -->
    <AppModal v-if="resetting" title="Parolni tiklash" @close="resetting = null">
      <div class="space-y-4">
        <p class="text-sm text-ink-muted">
          <span class="font-medium text-ink">{{ resetting.name }}</span> uchun yangi parol
          o'rnatiladi va bu hisobning <span class="font-medium text-ink">barcha seanslari</span>
          yakunlanadi.
        </p>

        <AppInput v-model="resetForm.password" label="Yangi parol" type="password" />
        <AppInput
          v-model="resetForm.password_confirmation"
          label="Parolni takrorlang"
          type="password"
        />

        <div class="flex gap-2">
          <AppButton variant="ghost" class="flex-1" @click="resetting = null">
            Bekor qilish
          </AppButton>
          <AppButton class="flex-1" :loading="saving" @click="resetPassword">Tiklash</AppButton>
        </div>
      </div>
    </AppModal>

    <!-- Delete confirmation -->
    <AppModal v-if="confirmingDelete" title="Butunlay o'chirish" @close="confirmingDelete = null">
      <div class="space-y-4">
        <p class="text-sm text-ink">
          <span class="font-medium">{{ confirmingDelete.name }}</span> hisobi butunlay o'chiriladi.
        </p>
        <p class="text-sm text-ink-muted">
          Odatda <span class="font-medium text-ink">o'chirish</span> (deaktivatsiya) to'g'riroq:
          u kirishni to'xtatadi, lekin audit logdagi yozuvlar kim tomonidan qilingani ma'lum
          bo'lib qoladi.
        </p>

        <div class="flex gap-2">
          <AppButton variant="ghost" class="flex-1" @click="confirmingDelete = null">
            Bekor qilish
          </AppButton>
          <AppButton variant="danger" class="flex-1" @click="remove">O'chirish</AppButton>
        </div>
      </div>
    </AppModal>
  </AdminLayout>
</template>
