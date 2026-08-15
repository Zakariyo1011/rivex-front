import client from './client'

export type Visibility = 'everyone' | 'followers' | 'only_me'
export type FollowPolicy = 'everyone' | 'verified_only' | 'nobody'

export interface PrivacySettings {
  profile_visibility: Visibility
  who_can_follow: FollowPolicy
  who_can_see_followers: Visibility
  /** Who may *start* a conversation. Existing threads are unaffected. */
  who_can_message: Visibility
  discoverable_in_search: boolean
  show_online_status: boolean
  /** Derived on the server from `profile_visibility` — never sent back. */
  follow_needs_approval: boolean
}

export interface PrivacyOption<T extends string> {
  value: T
  label: string
  description: string
}

/**
 * Labels come from the server rather than being duplicated here.
 *
 * The wording of a privacy choice is part of the rule it describes, and a
 * client-side copy would drift from the enum that actually enforces it.
 */
export interface PrivacyOptions {
  visibility: PrivacyOption<Visibility>[]
  follow_policy: PrivacyOption<FollowPolicy>[]
}

export interface PrivacyResponse {
  data: PrivacySettings
  options: PrivacyOptions
}

/** Only ever the caller's own settings — there is no endpoint for anyone else's. */
export const privacyApi = {
  show() {
    return client.get<PrivacyResponse>('/me/privacy')
  },
  update(payload: Partial<Omit<PrivacySettings, 'follow_needs_approval'>>) {
    return client.put<PrivacyResponse>('/me/privacy', payload)
  },
}
