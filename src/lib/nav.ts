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
 * `activity-create` is the centred action, marked so the bar can render it as
 * the raised button rather than a tab.
 *
 * ## Why Activities is here and Search is not
 *
 * This bar used to carry Search and *neither* Explore nor Applications, which
 * meant the two screens the product is actually about — the activities you can
 * join, and the applications waiting on your decision — had **no mobile entry
 * point at all**. They were reachable only from the desktop sidebar. Somebody
 * organising a meet-up on a phone could not find the people asking to join it.
 *
 * Four slots is the honest limit at 375px, so Search gave up its place. That
 * trade was defensible; the way it was carried out was not. The stated
 * replacement — "Home opens with a full-width search field" — was not true:
 * Home's field routed to **Explore**, which browses activities and cannot find
 * a person, so giving up this slot left global search with no mobile entry
 * point whatsoever.
 *
 * Both halves are now real. Home's field opens `search` (see HomeView), and
 * `AppLayout` puts a search button in the mobile header beside the bell, so it
 * is one tap from every screen rather than only from Home. This bar keeps its
 * four destinations, and desktop keeps its sidebar row — all three lead to the
 * same route.
 *
 * Applications is not a fifth tab — it is a tab *inside* Activities, along with
 * Discover and My Activities. See ActivitiesTabs.
 */
export const bottomNavItems: (NavItem & { action?: boolean })[] = [
  { name: 'home', icon: icons.home, labelKey: 'nav.home' },
  { name: 'explore', icon: icons.date, labelKey: 'nav.explore' },
  { name: 'activity-create', icon: icons.add, labelKey: '', action: true },
  { name: 'chats', icon: icons.chat, labelKey: 'nav.chats' },
  { name: 'profile', icon: icons.profile, labelKey: 'nav.profile' },
]

/**
 * The three faces of Activities, in the order they are used.
 *
 * Kept here beside the two navigations for the same reason they are: a
 * destination defined next to the component that renders it is a destination
 * that drifts out of step with the other breakpoint.
 *
 * Each is a real route rather than local component state, so a tab is
 * linkable, survives a reload, and answers the back button — which
 * `notificationLinks` and the activity detail page both depend on.
 */
export const activityTabs: { name: string; labelKey: string; badge?: 'pendingApplications' }[] = [
  { name: 'explore', labelKey: 'nav.discover' },
  { name: 'my-activities', labelKey: 'nav.myActivities' },
  { name: 'applications', labelKey: 'nav.applications', badge: 'pendingApplications' },
]
