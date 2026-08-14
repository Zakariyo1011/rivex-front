import client from './client'
import type { Category } from '@/types'

export const categoriesApi = {
  /**
   * Top-level categories, flat.
   *
   * Unchanged since it was written, and deliberately still the default: most
   * screens want a shelf list, not a tree.
   */
  list() {
    return client.get<{ data: Category[] }>('/categories')
  },

  /** The same roots with their subcategories nested under `children`. */
  tree() {
    return client.get<{ data: Category[] }>('/categories/tree')
  },
}
