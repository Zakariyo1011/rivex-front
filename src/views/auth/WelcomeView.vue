<script setup lang="ts">
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { icons } from '@/lib/icons'

const router = useRouter()
</script>

<template>
  <AuthLayout>
    <div class="md:hidden text-center mb-10">
      <div class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl text-primary-600 mx-auto mb-4">
        <FontAwesomeIcon :icon="icons.brand" />
      </div>
      <h1 class="text-2xl font-bold text-ink">Rivex</h1>
      <p class="text-ink-muted mt-1">Har qanday faoliyat uchun sherik toping.</p>

      <ul class="mt-6 space-y-2.5 text-left inline-block">
        <li class="flex items-center gap-2.5 text-sm text-ink-secondary">
          <span class="w-5 h-5 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px]">
            <FontAwesomeIcon :icon="icons.check" />
          </span>
          Tasdiqlangan foydalanuvchilar
        </li>
        <li class="flex items-center gap-2.5 text-sm text-ink-secondary">
          <span class="w-5 h-5 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px]">
            <FontAwesomeIcon :icon="icons.check" />
          </span>
          Xavfsiz va ishonchli
        </li>
        <li class="flex items-center gap-2.5 text-sm text-ink-secondary">
          <span class="w-5 h-5 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px]">
            <FontAwesomeIcon :icon="icons.check" />
          </span>
          Haqiqiy aloqalar
        </li>
      </ul>
    </div>

    <div class="hidden md:block mb-8">
      <h2 class="text-2xl font-bold text-ink">Xush kelibsiz!</h2>
      <p class="text-ink-muted mt-1">Davom etish uchun hisobingizga kiring yoki ro'yxatdan o'ting.</p>
    </div>

    <div class="space-y-3">
      <AppButton variant="primary" @click="router.push({ name: 'register' })">Ro'yxatdan o'tish</AppButton>
      <AppButton variant="outline" @click="router.push({ name: 'login' })">Kirish</AppButton>
    </div>
  </AuthLayout>
</template>
