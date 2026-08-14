import client from './client'
import type { Visibility } from './privacy'

/** Where a section keeps its contents — see the backend enum of the same name. */
export type SectionSource = 'payload' | 'tags' | 'interests' | 'social_links'

export type SectionKind =
  | 'about' | 'education' | 'work' | 'skills' | 'hobbies' | 'interests' | 'languages'
  | 'books' | 'movies' | 'games' | 'music' | 'places' | 'goals'
  | 'achievements' | 'social_links' | 'custom'

export interface SectionItem {
  id?: number
  title: string
  note?: string
  degree?: string
  role?: string
  from?: number
  to?: number
  current?: boolean
  author?: string
  year?: number
  artist?: string
  country?: string
  /** Tag- and link-backed sections only. */
  slug?: string
  level?: string
  platform?: string
  value?: string
  url?: string
  /**
   * The payload is a JSON column server-side and its fields differ per
   * section, so items genuinely carry dynamic keys. The named fields above are
   * the ones the client knows about; the index signature is the honest
   * description of the rest, and it is what lets the editor read and write a
   * field by name without casting at every use.
   */
  [key: string]: string | number | boolean | undefined
}

export interface ProfileSection {
  id: number
  kind: SectionKind
  slug: string
  title: string
  position: number
  source: SectionSource
  items: SectionItem[]
  text: string | null
  /** Owner only — absent when viewing someone else's profile. */
  visibility?: Visibility
}

export interface UpsertSectionPayload {
  kind: SectionKind
  visibility?: Visibility
  payload?: { text?: string; title?: string; items?: SectionItem[] }
}

export interface TagItem {
  id?: number
  name: string
  slug?: string
  level?: string | null
}

export type TagType = 'skill' | 'hobby' | 'language'

export interface SocialLink {
  id?: number
  platform: string
  label?: string
  value: string
  url?: string
}

export const sectionsApi = {
  mine() {
    return client.get<{ data: ProfileSection[] }>('/me/profile/sections')
  },
  upsert(payload: UpsertSectionPayload) {
    return client.put<{ data: ProfileSection }>('/me/profile/sections', payload)
  },
  remove(id: number) {
    return client.delete(`/me/profile/sections/${id}`)
  },
  reorder(ids: number[]) {
    return client.put<{ data: ProfileSection[] }>('/me/profile/sections/order', { ids })
  },
  tagSuggestions(type: TagType, q = '') {
    return client.get<{ data: TagItem[] }>(`/tags/${type}`, { params: { q } })
  },
  syncTags(type: TagType, tags: TagItem[]) {
    return client.put<{ data: TagItem[] }>(`/me/tags/${type}`, {
      tags: tags.map((t) => ({ name: t.name, level: t.level ?? null })),
    })
  },
  socialLinks() {
    return client.get<{ data: SocialLink[]; platforms: { value: string; label: string; is_handle: boolean }[] }>(
      '/me/social-links',
    )
  },
  syncSocialLinks(links: SocialLink[]) {
    return client.put<{ data: SocialLink[] }>('/me/social-links', {
      links: links.map((l) => ({ platform: l.platform, value: l.value })),
    })
  },
}
