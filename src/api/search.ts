import client from './client'
import type { ActivityFilters } from './activities'
import type { Activity, Category, FollowRelationship, User } from '@/types'

export type SearchTypeKey = 'all' | 'users' | 'activities' | 'categories'

/** The three fields the server resolves in bulk for a page of people. */
export type SearchRelationship = Pick<
  FollowRelationship,
  'is_following' | 'follow_status' | 'is_followed_by'
>

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

/** `type=all`: a preview of each kind, so the client can pick a tab. */
export interface SearchOverview {
  query: string
  type: 'all'
  results: {
    users: { data: User[]; total: number }
    activities: { data: Activity[]; total: number }
    categories: { data: Category[]; total: number }
  }
  relationships: Record<string, SearchRelationship>
  meta: { counts: Record<SearchTypeKey, number> }
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
  overview(q: string) {
    return client.get<SearchOverview>('/search', { params: { q, type: 'all' } })
  },
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
  categories(q: string, page = 1) {
    return client.get<SearchPage<Category>>('/search', {
      params: { q, type: 'categories', page },
    })
  },
  suggest(q: string) {
    return client.get<{ query: string; suggestions: Suggestion[] }>('/search/suggest', {
      params: { q },
    })
  },
}
