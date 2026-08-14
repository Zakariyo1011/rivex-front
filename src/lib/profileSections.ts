import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { icons } from './icons'
import type { SectionKind } from '@/api/sections'

/**
 * How each section is labelled, iconed and edited.
 *
 * One table rather than a chain of `v-if`s in the profile view. The same
 * argument as `notificationLinks.ts`: every section needs an answer to the
 * same three questions, and the answers belong next to each other so that
 * adding a section is one entry rather than an edit in four components.
 *
 * A kind that is missing from this table is skipped rather than crashing —
 * that is an older client meeting a newer server, not a bug worth a blank page.
 */

/** Which editor the section uses. Four shapes cover all fifteen sections. */
export type SectionForm = 'text' | 'list' | 'timeline' | 'tags' | 'links' | 'interests'

export interface SectionPresentation {
  labelKey: string
  icon: IconDefinition
  form: SectionForm
  /** Extra per-item fields the list editor should offer, beyond the title. */
  fields?: { key: string; label: string; type?: 'text' | 'number' }[]
  placeholder?: string
}

export const SECTION_REGISTRY: Partial<Record<SectionKind, SectionPresentation>> = {
  about: { labelKey: 'Men haqimda', icon: icons.profile, form: 'text', placeholder: "O'zingiz haqingizda qisqacha yozing" },

  interests: { labelKey: 'Qiziqishlar', icon: icons.explore, form: 'interests' },
  skills: { labelKey: "Ko'nikmalar", icon: icons.trust, form: 'tags' },
  hobbies: { labelKey: "Mashg'ulotlar", icon: icons.applications, form: 'tags' },
  languages: { labelKey: 'Tillar', icon: icons.chat, form: 'tags' },

  work: {
    labelKey: 'Ish',
    icon: icons.applications,
    form: 'timeline',
    fields: [
      { key: 'role', label: 'Lavozim' },
      { key: 'from', label: 'Boshlangan yil', type: 'number' },
      { key: 'to', label: 'Tugagan yil', type: 'number' },
    ],
  },
  education: {
    labelKey: "Ta'lim",
    icon: icons.applications,
    form: 'timeline',
    fields: [
      { key: 'degree', label: "Yo'nalish" },
      { key: 'from', label: 'Boshlangan yil', type: 'number' },
      { key: 'to', label: 'Tugagan yil', type: 'number' },
    ],
  },

  books: { labelKey: 'Kitoblar', icon: icons.applications, form: 'list', fields: [{ key: 'author', label: 'Muallif' }] },
  movies: { labelKey: 'Filmlar', icon: icons.explore, form: 'list', fields: [{ key: 'year', label: 'Yil', type: 'number' }] },
  games: { labelKey: "O'yinlar", icon: icons.explore, form: 'list', fields: [{ key: 'year', label: 'Yil', type: 'number' }] },
  music: { labelKey: 'Musiqa', icon: icons.explore, form: 'list', fields: [{ key: 'artist', label: 'Ijrochi' }] },
  places: {
    labelKey: 'Borgan joylarim',
    icon: icons.location,
    form: 'list',
    fields: [
      { key: 'country', label: 'Davlat' },
      { key: 'year', label: 'Yil', type: 'number' },
    ],
  },
  goals: { labelKey: 'Maqsadlar', icon: icons.trust, form: 'list' },
  achievements: { labelKey: 'Yutuqlar', icon: icons.verified, form: 'list' },

  social_links: { labelKey: 'Ijtimoiy tarmoqlar', icon: icons.chat, form: 'links' },
  custom: { labelKey: "O'z bo'limim", icon: icons.edit, form: 'list' },
}

export function sectionPresentation(kind: SectionKind): SectionPresentation | null {
  return SECTION_REGISTRY[kind] ?? null
}

/** Sections a user may add, in the order the product wants them filled. */
export const ADDABLE_KINDS: SectionKind[] = [
  'about', 'interests', 'skills', 'languages', 'work', 'education', 'hobbies',
  'books', 'movies', 'games', 'music', 'places', 'goals',
  'achievements', 'social_links', 'custom',
]
