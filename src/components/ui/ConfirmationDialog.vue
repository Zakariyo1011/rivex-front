<script setup lang="ts">
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'

withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    loading?: boolean
  }>(),
  { confirmLabel: 'Tasdiqlash', cancelLabel: 'Bekor qilish', danger: false, loading: false },
)
defineEmits<{ confirm: []; close: [] }>()
</script>

<template>
  <AppModal :title="title" @close="$emit('close')">
    <p class="text-sm text-ink-secondary mb-5">{{ message }}</p>
    <div class="flex gap-3">
      <AppButton variant="outline" @click="$emit('close')">{{ cancelLabel }}</AppButton>
      <AppButton :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="$emit('confirm')">
        {{ confirmLabel }}
      </AppButton>
    </div>
  </AppModal>
</template>
