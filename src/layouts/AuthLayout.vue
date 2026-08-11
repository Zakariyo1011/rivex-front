<script setup lang="ts">
import { icons } from '@/lib/icons'

withDefaults(
  defineProps<{
    showBrandPanel?: boolean
  }>(),
  { showBrandPanel: true },
)
</script>

<template>
  <div class="min-h-screen bg-surface md:flex">
    <div
      v-if="showBrandPanel"
      class="hidden md:flex md:w-[42%] lg:w-[38%] flex-col justify-between bg-gradient-to-br from-primary-600 to-primary-800 text-white p-12 relative overflow-hidden"
    >
      <div class="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5"></div>
      <div class="absolute -left-16 bottom-0 w-72 h-72 rounded-full bg-white/5"></div>

      <div class="relative flex items-center gap-2">
        <div class="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
          <FontAwesomeIcon :icon="icons.brand" />
        </div>
        <span class="text-xl font-semibold tracking-tight">Rivex</span>
      </div>

      <div class="relative space-y-6">
        <h1 class="text-4xl font-bold leading-tight">
          Har qanday faoliyat uchun sherik toping.
        </h1>
        <p class="text-primary-100 text-lg leading-relaxed">
          O'yin, sport, ovqatlanish, sayohat — nima qilishni xohlasangiz, Rivex sizga mos sherik topib beradi.
        </p>
        <ul class="space-y-3 pt-2">
          <li class="flex items-center gap-3 text-primary-50">
            <span class="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs">
              <FontAwesomeIcon :icon="icons.check" />
            </span>
            Tasdiqlangan foydalanuvchilar
          </li>
          <li class="flex items-center gap-3 text-primary-50">
            <span class="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs">
              <FontAwesomeIcon :icon="icons.check" />
            </span>
            Xavfsiz va ishonchli
          </li>
          <li class="flex items-center gap-3 text-primary-50">
            <span class="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs">
              <FontAwesomeIcon :icon="icons.check" />
            </span>
            Haqiqiy aloqalar
          </li>
        </ul>
      </div>

      <p class="relative text-sm text-primary-200">© {{ new Date().getFullYear() }} Rivex</p>
    </div>

    <div class="flex-1 flex flex-col justify-center items-center px-6 py-10 md:px-16">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
