import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { icons } from './icons'

export interface NavItem {
  name: string
  icon: IconDefinition
  labelKey: string
}

/**
 * The application's destinations, in one file.
 *
 * The two navigations are genuinely different lists rather than one list
 * rendered twice — the sidebar has room for six entries and the bottom bar has
 * five slots around a centred create button, which is why `explore` and
 * `applications` are desktop-only. But they were *defined* in two places (this
 * file and inside BottomNav), which is how a destination ends up reachable on
 * one breakpoint and not the other without anyone deciding that.
 *
 * They live together here so the difference between them is visible and
 * deliberate.
 */
export const mainNavItems: NavItem[] = [
  { name: 'home', icon: icons.home, labelKey: 'nav.home' },
  { name: 'search', icon: icons.explore, labelKey: 'nav.search' },
  { name: 'explore', icon: icons.date, labelKey: 'nav.explore' },
  { name: 'applications', icon: icons.applications, labelKey: 'nav.applications' },
  { name: 'chats', icon: icons.chat, labelKey: 'nav.chats' },
  { name: 'profile', icon: icons.profile, labelKey: 'nav.profile' },
]

/**
 * The mobile bar: four destinations around the create button.
 *
 * Global search is the discovery entry here; Explore stays reachable from the
 * sidebar and from Home. Six items plus the create button does not fit at
 * 375px, and search is the broader of the two.
 *
 * `activity-create` is the centred action, marked so the bar can render it as
 * the raised button rather than a tab.
 */
export const bottomNavItems: (NavItem & { action?: boolean })[] = [
  { name: 'home', icon: icons.home, labelKey: 'nav.home' },
  { name: 'search', icon: icons.explore, labelKey: 'nav.search' },
  { name: 'activity-create', icon: icons.add, labelKey: '', action: true },
  { name: 'chats', icon: icons.chat, labelKey: 'nav.chats' },
  { name: 'profile', icon: icons.profile, labelKey: 'nav.profile' },
]
