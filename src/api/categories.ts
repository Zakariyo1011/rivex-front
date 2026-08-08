import client from './client'
import type { Category } from '@/types'

export const categoriesApi = {
  list() {
    return client.get<{ data: Category[] }>('/categories')
  },
}
