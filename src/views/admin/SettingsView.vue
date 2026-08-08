<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { adminApi } from '@/api/admin'

const commissionRate = ref(0)
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)

async function save() {
  saving.value = true
  saved.value = false
  try {
    await adminApi.updateCommission(commissionRate.value)
    saved.value = true
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const { data } = await adminApi.settings()
  commissionRate.value = data.data.commission_rate
  loading.value = false
})
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Sozlamalar</h1>

    <div class="card p-6 max-w-md">
      <h2 class="font-semibold text-ink mb-1">Platforma komissiyasi</h2>
      <p class="text-sm text-ink-muted mb-4">
        Pullik to'lovlardan (owner_pays / participant_pays) olinadigan komissiya foizi.
      </p>

      <div v-if="loading" class="text-sm text-ink-faint">Yuklanmoqda...</div>
      <template v-else>
        <label class="block mb-4">
          <span class="block text-sm font-medium text-ink-secondary mb-1.5">Komissiya (%)</span>
          <input
            v-model.number="commissionRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            class="w-full h-12 px-4 rounded-xl border border-border bg-white text-[15px] outline-none focus:ring-2 focus:ring-primary-100"
          />
        </label>

        <p v-if="saved" class="text-sm text-success mb-3">✓ Saqlandi</p>

        <AppButton :loading="saving" @click="save">Saqlash</AppButton>
      </template>
    </div>
  </AdminLayout>
</template>
