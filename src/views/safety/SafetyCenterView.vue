<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

const router = useRouter()

interface Section {
  icon: string
  title: string
  tips: string[]
}

const sections: Section[] = [
  {
    icon: '🤝',
    title: 'Birinchi uchrashuv',
    tips: [
      "Har doim ochiq va odam ko'p joyda uchrashing — kafe, park, savdo markazi.",
      "Birinchi marta uchrashganda do'stingiz yoki oila a'zoingizga qayerga borayotganingizni ayting.",
      "O'zingiz mustaqil boring va qaytish yo'lini oldindan rejalashtiring.",
      "Ichkilik yoki ovqatingizni bir zumga ham bo'lsa qarovsiz qoldirmang.",
    ],
  },
  {
    icon: '🔒',
    title: 'Shaxsiy ma\'lumotlar',
    tips: [
      "Uy manzilingiz, ish joyingiz yoki moliyaviy ma'lumotlaringizni sherik bilan ulashmang.",
      "Passport yoki ID karta ma'lumotlaringiz boshqa foydalanuvchilarga hech qachon ko'rsatilmaydi — buni so'ragan odamga ishonmang.",
      "Suhbatni imkon qadar ilova ichida davom ettiring, tashqi messenjerlarga shoshilmang.",
    ],
  },
  {
    icon: '💳',
    title: "To'lovlar xavfsizligi",
    tips: [
      "Rivex faoliyat egasi va sherik o'rtasidagi kelishilgan summani o'zida ushlab turmaydi — bu tomonlar o'rtasidagi shaxsiy kelishuv.",
      "Katta summani oldindan, uchrashuvdan tashqarida hech kimga o'tkazib yubormang.",
      "To'lovni imkon qadar uchrashuv joyida, yuzma-yuz amalga oshiring.",
      "Shubhali yoki bosim ostida qoldiruvchi to'lov so'rovlari haqida darhol xabar bering.",
    ],
  },
  {
    icon: '🚩',
    title: 'Shubhali xatti-harakat',
    tips: [
      "Profilida nomuvofiqlik yoki g'alati xatti-harakat sezsangiz, activity yoki chatga qo'shilishdan oldin ehtiyot bo'ling.",
      "✓ Tasdiqlangan (identity verified) belgisi bor foydalanuvchilarga ustunlik bering.",
      'Har qanday bezovtalik, firibgarlik yoki xavfsizlik holatini "Shikoyat qilish" orqali darhol bildiring.',
      "Muloqotni istagan vaqtingizda to'xtatish uchun foydalanuvchini bloklashingiz mumkin.",
    ],
  },
  {
    icon: '🆘',
    title: 'Favqulodda holatlar',
    tips: [
      'Zudlik bilan xavf mavjud bo\'lsa, darhol 102 (politsiya) raqamiga qo\'ng\'iroq qiling.',
      "Xavfsizligingizga tahdid bo'lgan holatdan keyin Rivex qo'llab-quvvatlash xizmatiga ham murojaat qiling.",
    ],
  },
]

function goToReport() {
  router.push({ name: 'profile' })
}
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="flex items-center gap-3 mb-2">
        <button class="text-ink-muted text-xl" @click="router.back()">←</button>
        <h1 class="text-xl font-bold text-ink">Xavfsizlik markazi</h1>
      </div>
      <p class="text-sm text-ink-muted mb-6 ml-9">
        Rivex haqiqiy hayotda notanish odamlar bilan uchrashishga yordam beradi. Xavfsiz bo'lish uchun quyidagi tavsiyalarga rioya qiling.
      </p>

      <div class="space-y-4">
        <div v-for="section in sections" :key="section.title" class="card p-5">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="text-xl">{{ section.icon }}</span>
            <h2 class="font-semibold text-ink">{{ section.title }}</h2>
          </div>
          <ul class="space-y-2">
            <li v-for="tip in section.tips" :key="tip" class="text-sm text-ink-secondary flex gap-2">
              <span class="text-primary-500 shrink-0">•</span>
              <span>{{ tip }}</span>
            </li>
          </ul>
        </div>
      </div>

      <button
        class="w-full h-12 rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm font-medium mt-6"
        @click="goToReport"
      >
        🚩 Foydalanuvchini shikoyat qilish yoki bloklash
      </button>
    </div>
  </AppLayout>
</template>
