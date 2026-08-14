<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import { profileApi } from '@/api/profile'
import { useAuthStore } from '@/stores/auth'
import { useUsernameCheck } from '@/composables/useUsernameCheck'
import { extractErrorMessage } from '@/composables/useApiError'
import { formatDate } from '@/lib/datetime'
import { icons } from '@/lib/icons'

/**
 * Reading and changing your own handle, from the profile editor.
 *
 * The point of interest here is that this screen enforces the *same* two rules
 * the API does, from the same source, and in the order the API applies them:
 *
 *   1. May this account change at all right now? — the cooldown, answered by
 *      `username_policy` beside /me. Checked first, because when the answer is
 *      no the availability of any particular handle is beside the point.
 *   2. Is this handle free? — answered by /username/available, advisory only,
 *      settled for real by the unique index on write.
 *
 * Before this existed the client knew only (2), so someone inside their
 * cooldown was shown a green tick and a live save button, and learned about
 * the wait from a rejection. The rule had not changed; it was simply invisible.
 */

const auth = useAuthStore()

const editing = ref(false)
const saving = ref(false)
const error = ref('')
const draft = ref('')

const policy = computed(() => auth.usernamePolicy)
const current = computed(() => auth.user?.username ?? null)

const { normalised, isCurrent, status, reason, reject } = useUsernameCheck(draft, { current })

/**
 * The cooldown, as the server would answer it.
 *
 * Defaults to permitting the attempt when the policy has not loaded: the write
 * is authoritative either way, and a disabled field with no explanation is
 * worse than a rejection that explains itself.
 */
const canChange = computed(() => policy.value?.can_change_now ?? true)

const nextChangeLabel = computed(() =>
  policy.value?.next_change_allowed_at ? formatDate(policy.value.next_change_allowed_at) : null,
)

const canSubmit = computed(
  () => canChange.value && status.value === 'available' && !isCurrent.value && !saving.value,
)

function start() {
  error.value = ''
  // Pre-filled with the handle they hold: this is an edit, not a fresh claim,
  // and starting empty asks someone to retype a name they only want to tweak.
  draft.value = current.value ?? ''
  editing.value = true
}

function cancel() {
  editing.value = false
  draft.value = ''
  error.value = ''
}

async function save() {
  if (!canSubmit.value) return

  saving.value = true
  error.value = ''

  try {
    await profileApi.updateUsername(normalised.value)
    // /me is the one place the policy is served, so the cooldown this change
    // just started is read back rather than guessed at locally.
    await auth.fetchMe()
    editing.value = false
    draft.value = ''
  } catch (e) {
    error.value = extractErrorMessage(e)
    // The server is the authority: a rejection here overrides whatever the
    // advisory check said a moment ago.
    reject(error.value)
  } finally {
    saving.value = false
  }
}

// A cooldown that begins while the form is open should close it, rather than
// leaving a live-looking field that can no longer be submitted.
watch(canChange, (allowed) => {
  if (!allowed) editing.value = false
})
</script>

<template>
  <AppCard class="mb-4">
    <div class="flex items-center justify-between gap-3 mb-1">
      <h2 class="font-semibold text-ink">Foydalanuvchi nomi</h2>
      <button
        v-if="!editing && canChange"
        type="button"
        class="text-sm text-primary-600 font-medium"
        @click="start"
      >
        {{ current ? 'Tahrirlash' : 'Tanlash' }}
      </button>
      <button
        v-else-if="editing"
        type="button"
        class="text-sm text-ink-muted font-medium"
        @click="cancel"
      >
        Bekor qilish
      </button>
    </div>

    <!-- Read state -->
    <template v-if="!editing">
      <RouterLink
        v-if="current"
        :to="{ name: 'user-profile-by-username', params: { username: current } }"
        class="text-[15px] text-ink hover:text-primary-600 transition-colors"
      >
        @{{ current }}
      </RouterLink>
      <p v-else class="text-[15px] text-ink-faint">Hali tanlanmagan</p>

      <p class="text-sm text-ink-muted mt-1.5">
        Odamlar sizni shu nom orqali topadi va profilingizga havola qiladi.
      </p>

      <!-- The wait, stated with its end date. "Try again later" is not an
           answer someone can plan around. -->
      <p
        v-if="!canChange && nextChangeLabel"
        class="mt-3 flex items-start gap-2 text-sm text-ink-muted"
      >
        <FontAwesomeIcon :icon="icons.time" class="text-ink-faint text-xs mt-1" />
        <span>
          Foydalanuvchi nomini <strong class="text-ink">{{ nextChangeLabel }}</strong> dan keyin
          o'zgartira olasiz.
        </span>
      </p>

      <p
        v-else-if="current && policy?.free_change_available"
        class="mt-3 flex items-start gap-2 text-sm text-ink-muted"
      >
        <FontAwesomeIcon :icon="icons.info" class="text-ink-faint text-xs mt-1" />
        <span>
          Birinchi o'zgartirish bepul. Undan keyin har
          {{ policy.cooldown_days }} kunda bir marta o'zgartirish mumkin.
        </span>
      </p>
    </template>

    <!-- Edit state -->
    <form v-else class="mt-3 space-y-3" @submit.prevent="save">
      <label class="block">
        <div
          class="flex items-center h-12 px-4 rounded-xl border bg-surface transition-colors"
          :class="{
            'border-border': status === 'idle' || status === 'checking',
            'border-success': status === 'available',
            'border-danger': status === 'taken',
          }"
        >
          <span class="text-ink-faint mr-0.5 select-none">@</span>
          <input
            v-model="draft"
            type="text"
            inputmode="text"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            maxlength="30"
            placeholder="zakariyo_dev"
            class="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
          />
          <FontAwesomeIcon
            v-if="status === 'available'"
            :icon="icons.check"
            class="text-success text-sm"
          />
          <span
            v-else-if="status === 'checking'"
            class="w-4 h-4 rounded-full border-2 border-border border-t-primary-500 animate-spin"
          />
        </div>

        <p v-if="isCurrent" class="mt-1.5 text-sm text-ink-muted">Bu sizning hozirgi nomingiz.</p>
        <p v-else-if="status === 'taken' && reason" class="mt-1.5 text-sm text-danger">
          {{ reason }}
        </p>
        <p v-else-if="status === 'available'" class="mt-1.5 text-sm text-success">Bu nom bo'sh.</p>
      </label>

      <!-- What changing it costs. The old handle is quarantined rather than
           freed, so this is not reversible on a whim. -->
      <div
        v-if="current"
        class="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-sm text-ink-muted"
      >
        <FontAwesomeIcon :icon="icons.warning" class="text-ink-faint text-xs mt-1" />
        <span>
          <strong class="text-ink-secondary">@{{ current }}</strong> ga qo'yilgan havolalar
          ishlamay qoladi.
          <template v-if="policy?.free_change_available">
            Bu birinchi o'zgartirish — bepul. Keyingisi
            {{ policy.cooldown_days }} kundan keyin mumkin bo'ladi.
          </template>
          <template v-else-if="policy">
            Keyingi o'zgartirish {{ policy.cooldown_days }} kundan keyin mumkin bo'ladi.
          </template>
        </span>
      </div>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <AppButton type="submit" :disabled="!canSubmit" :loading="saving">Saqlash</AppButton>
    </form>
  </AppCard>
</template>
