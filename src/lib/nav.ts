import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { icons } from './icons'

export interface NavItem {
  name: string
  icon: IconDefinition
  labelKey: string
}

export const mainNavItems: NavItem[] = [
  { name: 'home', icon: icons.home, labelKey: 'nav.home' },
  { name: 'search', icon: icons.explore, labelKey: 'nav.search' },
  { name: 'explore', icon: icons.date, labelKey: 'nav.explore' },
  { name: 'applications', icon: icons.applications, labelKey: 'nav.applications' },
  { name: 'chats', icon: icons.chat, labelKey: 'nav.chats' },
  { name: 'profile', icon: icons.profile, labelKey: 'nav.profile' },
]
