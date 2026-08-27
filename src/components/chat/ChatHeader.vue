<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from '@/components/ui/Avatar.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import { icons } from '@/lib/icons'
import type { Conversation } from '@/types'
import { userProfileRoute, userDisplayName } from '@/lib/userLink'

/**
 * Who you are talking to.
 *
 * A direct thread is titled by the person, a group thread by its activity. The
 * old header ran `otherPerson()` over every thread — picking the owner, or else
 * whichever participant was not you — so a five-person activity was headed by
 * one arbitrary member's name and face. Group threads now say what they are.
 */
const props = defineProps<{
  conversation: Conversation
  online?: boolean
  typingLabel?: string | null
}>()

const router = useRouter()

const isDirect = computed(() => props.conversation.type === 'direct')
const person = computed(() => props.conversation.counterpart)

const title = computed(() =>
  isDirect.value
    ? userDisplayName(person.value)
    : (props.conversation.activity?.title ?? 'Suhbat'),
)

const participants = computed(() => props.conversation.participants ?? [])

/** At most three faces; the rest become a "+N" chip. */
const facePile = computed(() => participants.value.slice(0, 3))
const overflowCount = computed(() => Math.max(0, participants.value.length - facePile.value.length))

const subtitle = computed(() => {
  if (props.typingLabel) return props.typingLabel
  if (isDirect.value) return props.online ? 'Onlayn' : null

  const count = participants.value.length
  const owner = props.conversation.activity?.owner

  // The organiser is worth naming: in a room of five it is the one role that
  // differs, and it is who a participant addresses about the meet-up itself.
  const parts = [count ? `${count} ishtirokchi` : null, owner ? `Tashkilotchi: ${userDisplayName(owner)}` : null]

  return parts.filter(Boolean).join(' · ') || null
})

const subtitleTone = computed(() => {
  if (props.typingLabel) return 'text-primary-600'

  return isDirect.value && props.online ? 'text-success' : 'text-ink-muted'
})

/** The header is the way back to the profile — but only when there is one. */
function openProfile() {
  if (!isDirect.value || !person.value) return

  const target = userProfileRoute(person.value)
  if (target) router.push(target)
}
</script>

<template>
  <div class="flex items-center gap-3 px-3 md:px-8 py-2.5 border-b border-border bg-surface">
    <!-- The only way out of a conversation on a phone, and it was a 28x31
         hit box — under every touch-target guideline, on the control people
         reach for most in this screen. Sized as a proper 40px button; the
         negative margin keeps the icon where it was so the header does not
         shift. -->
    <button
      class="w-10 h-10 -ml-1.5 shrink-0 rounded-full flex items-center justify-center text-ink-muted text-lg md:hidden hover:bg-surface-muted active:bg-surface-muted transition"
      aria-label="Orqaga"
      @click="router.push({ name: 'chats' })"
    >
      <FontAwesomeIcon :icon="icons.back" />
    </button>

    <component
      :is="isDirect ? 'button' : 'div'"
      class="flex items-center gap-3 min-w-0 flex-1 text-left"
      :aria-label="isDirect ? `${title} profili` : undefined"
      @click="openProfile"
    >
      <div class="relative shrink-0">
        <Avatar
          v-if="isDirect"
          :src="person?.profile?.avatar_url"
          :name="person?.name ?? ''"
          size="md"
        />
        <!-- A group room is named by its activity, so the faces answer the
             next question: who else is in here. Overlapped rather than listed,
             because the header has one line and the count is the subtitle. -->
        <div v-else class="flex items-center">
          <Avatar
            v-for="(member, i) in facePile"
            :key="member.id"
            :src="member.profile?.avatar_url"
            :name="member.name"
            size="sm"
            class="ring-2 ring-surface"
            :class="i > 0 ? '-ml-3' : ''"
          />
          <span
            v-if="overflowCount > 0"
            class="-ml-3 w-8 h-8 rounded-full bg-surface-muted text-ink-muted text-[11px] font-semibold flex items-center justify-center ring-2 ring-surface"
          >
            +{{ overflowCount }}
          </span>
          <span
            v-if="facePile.length === 0"
            class="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center"
          >
            <FontAwesomeIcon :icon="icons.people" class="text-sm" />
          </span>
        </div>

        <span
          v-if="isDirect && online"
          class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface"
          aria-label="Onlayn"
        />
      </div>

      <div class="min-w-0">
        <p class="font-semibold text-ink truncate">{{ title }}</p>
        <p v-if="subtitle" class="text-xs truncate" :class="subtitleTone">{{ subtitle }}</p>
      </div>
    </component>

    <ReportBlockMenu
      v-if="isDirect && person"
      :user-id="person.id"
      :user-name="person.name"
    />
  </div>
</template>
