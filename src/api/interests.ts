import client from './client'

export interface Interest {
  id: number
  slug: string
  name: string
  icon: string | null
  /** The activity category this interest points at — null for the few none covers. */
  category: { id: number; slug: string; name: string; icon: string | null } | null
}

export interface InterestGroup {
  category: string
  interests: Interest[]
}

export interface InterestCatalogue {
  data: Interest[]
  grouped: InterestGroup[]
  /** The server-owned ceiling, so the picker does not keep its own copy. */
  max: number
}

export const interestsApi = {
  catalogue() {
    return client.get<InterestCatalogue>('/interests')
  },
  mine() {
    return client.get<{ data: Interest[] }>('/me/interests')
  },
  sync(ids: number[]) {
    return client.put<{ data: Interest[] }>('/me/interests', { interests: ids })
  },
}
