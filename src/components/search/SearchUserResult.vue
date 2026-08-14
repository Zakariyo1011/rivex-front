<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import FollowButton from '@/components/profile/FollowButton.vue'
import { icons } from '@/lib/icons'
import type { SearchRelationship } from '@/api/search'
import type { FollowRelationship, User } from '@/types'

const props = defineProps<{
  user: User
  relationship?: SearchRelationship
  /** The viewer, so a row never offers to follow the person looking at it. */
  viewerId?: number | null
}>()

const emit = defineEmits<{ 'update:relationship': [value: FollowRelationship] }>()

/**
 * A search row carries only the three fields the server resolves in bulk, so
 * the rest are filled in conservatively: a row never claims a follow can be
 * started when it does not know.
 */
const relationship = computed<FollowRelationship>(() => ({
  is_following: props.relationship?.is_following ?? false,
  follow_status: props.relationship?.follow_status ?? null,
  is_followed_by: props.relationship?.is_followed_by ?? false,
  can_follow: !props.relationship?.follow_status,
  follow_needs_approval: false,
}))

const isSelf = computed(() => props.viewerId != null && props.viewerId === props.user.id)

const to = computed(() =>
  props.user.username
    ? { name: 'user-profile-by-username', params: { username: props.user.username } }
    : { name: 'user-profile', params: { id: String(props.user.id) } },
)
</script>

<template>
  <li class="card p-3 flex items-center gap-3">
    <RouterLink :to="to" class="flex items-center gap-3 flex-1 min-w-0">
      <Avatar :src="user.profile?.avatar_url" :name="user.display_name" size="md" />
      <div class="min-w-0">
        <p class="font-medium text-ink truncate flex items-center gap-1.5">
          {{ user.display_name }}
          <VerificationBadge v-if="user.identity_verified" compact />
        </p>
        <p v-if="user.username" class="text-xs text-ink-faint truncate">@{{ user.username }}</p>

        <!-- A closed profile is findable by handle but shows nothing else.
             Saying so is kinder than rendering a person who looks empty. -->
        <p v-if="user.is_restricted" class="text-xs text-ink-faint truncate mt-0.5">
          <FontAwesomeIcon :icon="icons.lock" class="text-[0.6rem]" /> Yopiq profil
        </p>
        <p v-else-if="user.profile?.bio" class="text-xs text-ink-muted truncate mt-0.5">
          {{ user.profile.bio }}
        </p>

        <!-- Trust is a small signal beside the name, never the headline: it
             helps decide, it is not what the person was searching for. -->
        <p
          v-if="!user.is_restricted && user.trust_score !== undefined"
          class="text-[0.7rem] text-ink-faint mt-0.5 flex items-center gap-1"
        >
          <FontAwesomeIcon :icon="icons.trust" class="text-[0.6rem]" />
          {{ user.trust_score }}%
        </p>
      </div>
    </RouterLink>

    <FollowButton
      v-if="!isSelf"
      compact
      class="shrink-0"
      :user-id="user.id"
      :relationship="relationship"
      @update:relationship="(r) => emit('update:relationship', r)"
    />
  </li>
</template>
