<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { safetyApi, type ReportReason } from '@/api/safety'
import { extractErrorMessage } from '@/composables/useApiError'

const props = defineProps<{
  userId: number
  userName: string
}>()

const menuOpen = ref(false)
const showReportModal = ref(false)
const showBlockConfirm = ref(false)
const root = ref<HTMLElement | null>(null)

const reason = ref<ReportReason>('other')
const description = ref('')
const submitting = ref(false)
const error = ref('')
const reported = ref(false)
const blocked = ref(false)

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'fake_account', label: "Soxta akkaunt" },
  { value: 'harassment', label: "Bezovtalik" },
  { value: 'scam', label: "Firibgarlik" },
  { value: 'unsafe_behavior', label: "Xavfli xatti-harakat" },
  { value: 'inappropriate_content', label: "Nomaqbul kontent" },
  { value: 'no_show', label: "Kelmadi" },
  { value: 'payment_problem', label: "To'lov muammosi" },
  { value: 'other', label: "Boshqa" },
]

async function submitReport() {
  error.value = ''
  submitting.value = true
  try {
    await safetyApi.report(props.userId, reason.value, description.value || undefined)
    reported.value = true
    showReportModal.value = false
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    submitting.value = false
  }
}

async function confirmBlock() {
  submitting.value = true
  try {
    await safetyApi.block(props.userId)
    blocked.value = true
    showBlockConfirm.value = false
  } finally {
    submitting.value = false
  }
}

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) menuOpen.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="root" class="relative inline-block">
    <button
      class="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-ink-muted"
      @click="menuOpen = !menuOpen"
    >
      ⋮
    </button>

    <div v-if="menuOpen" class="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-border z-50 overflow-hidden">
      <button
        class="w-full text-left px-4 py-3 text-sm text-ink hover:bg-surface-muted"
        :disabled="reported"
        @click="showReportModal = true; menuOpen = false"
      >
        {{ reported ? '✓ Shikoyat yuborildi' : "🚩 Shikoyat qilish" }}
      </button>
      <button
        class="w-full text-left px-4 py-3 text-sm text-danger hover:bg-surface-muted"
        :disabled="blocked"
        @click="showBlockConfirm = true; menuOpen = false"
      >
        {{ blocked ? '✓ Bloklangan' : "🚫 Bloklash" }}
      </button>
    </div>

    <AppModal v-if="showReportModal" title="Shikoyat qilish" @close="showReportModal = false">
      <p class="text-sm text-ink-muted mb-3">{{ userName }} haqida shikoyat sababi</p>

      <div class="space-y-2 mb-4">
        <label
          v-for="r in reasons"
          :key="r.value"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer"
          :class="reason === r.value ? 'border-primary-500 bg-primary-50' : 'border-border'"
        >
          <input v-model="reason" type="radio" :value="r.value" class="accent-primary-600" />
          <span class="text-sm text-ink">{{ r.label }}</span>
        </label>
      </div>

      <textarea
        v-model="description"
        rows="3"
        placeholder="Qo'shimcha izoh (ixtiyoriy)"
        class="w-full rounded-xl border border-border p-3 text-[15px] outline-none focus:ring-2 focus:ring-primary-100 mb-3"
      />

      <p v-if="error" class="text-sm text-danger mb-3">{{ error }}</p>

      <AppButton :loading="submitting" @click="submitReport">Yuborish</AppButton>
    </AppModal>

    <AppModal v-if="showBlockConfirm" title="Bloklashni tasdiqlang" @close="showBlockConfirm = false">
      <p class="text-sm text-ink-muted mb-4">
        {{ userName }} ni bloklasangiz, u sizning faoliyatlaringizga ariza yubora olmaydi va siz bilan yoza olmaydi.
      </p>
      <div class="flex gap-3">
        <AppButton variant="outline" @click="showBlockConfirm = false">Bekor qilish</AppButton>
        <AppButton :loading="submitting" @click="confirmBlock">Bloklash</AppButton>
      </div>
    </AppModal>
  </div>
</template>
