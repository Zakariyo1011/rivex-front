import client from './client'
import type { ActivityFilters } from './activities'
import type { Activity, FollowRelationship, User } from '@/types'

/**
 * The two things Rivex searches for.
 *
 * It used to be four — `all`, `users`, `activities`, `categories` — rendered as
 * four tabs. That was the API's shape leaking into the product's: `all` is a
 * combined preview nobody asked for, and a category is not a *result*, it is a
 * way to browse activities. Four tabs at 375px also left "Kategoriyalar" three
 * characters wide.
 *
 * Search now has the two axes people actually have in mind when they open it:
 * find an activity, or find a person. Categories stay reachable from
 * autocomplete, where picking one deep-links into Explore filtered by it —
 * which is where browsing by category belongs.
 *
 * The server still implements all four types; this is the client narrowing what
 * it offers, not the API losing a capability.
 */
export type SearchTypeKey = 'activities' | 'users'

/**
 * The viewer's tie to a person in a search result.
 *
 * The COMPLETE relationship, not the three edge fields it used to be. Those
 * three say enough to *label* a row and not enough to make its button work:
 * without `can_follow` the client filled it in by deriving "there is no follow
 * row yet", which ignores blocks and `who_can_follow` entirely — so search
 * offered an enabled Follow button for an account refusing followers and the
 * tap came back 422. The server resolves all five in bulk now, exactly as it
 * already did for follower lists.
 */
export type SearchRelationship = FollowRelationship

export interface SearchMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

/** A single type, paginated. */
export interface SearchPage<T> {
  query: string
  type: SearchTypeKey
  data: T[]
  /** Keyed by user id. Empty object for non-user types. */
  relationships: Record<string, SearchRelationship>
  meta: SearchMeta
}

export interface Suggestion {
  type: 'users' | 'activities' | 'categories'
  id: number
  label: string
  sublabel: string | null
  username?: string | null
  slug?: string
  avatar_url?: string | null
}

/**
 * The floor the server applies, mirrored so the client does not spend a request
 * to be told a one-character query is too short. Kept equal to
 * `App\Search\SearchTerm::MIN_LENGTH` — the two disagreeing shows up as a
 * dropdown that flickers.
 */
export const MIN_SEARCH_LENGTH = 2

export const searchApi = {
  users(q: string, page = 1) {
    return client.get<SearchPage<User>>('/search', { params: { q, type: 'users', page } })
  },
  /**
   * @param filters the same set Explore applies, and applied by the same code
   *   server-side. A results page that offered no filters while Explore offered
   *   eight is why people abandoned a search to start again on the other
   *   screen. `sort` is deliberately not among them — search orders by
   *   relevance, and a sort control that relevance then overrode would be a
   *   control that lies.
   */
  activities(q: string, page = 1, filters: ActivityFilters = {}) {
    return client.get<SearchPage<Activity>>('/search', {
      params: { ...filters, q, type: 'activities', page },
    })
  },
  suggest(q: string) {
    return client.get<{ query: string; suggestions: Suggestion[] }>('/search/suggest', {
      params: { q },
    })
  },
}
