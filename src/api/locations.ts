import client from './client'
import type { District, Region, UserLocation } from '@/types'

export interface UpdateUserLocationPayload {
  region_id?: number | null
  district_id?: number | null
  latitude?: number
  longitude?: number
}

export const locationsApi = {
  regions() {
    return client.get<{ data: Region[] }>('/regions')
  },
  districts(regionId: number) {
    return client.get<{ data: District[] }>(`/regions/${regionId}/districts`)
  },
  me() {
    return client.get<{ data: UserLocation }>('/me/location')
  },
  updateMe(payload: UpdateUserLocationPayload) {
    return client.put<{ data: UserLocation }>('/me/location', payload)
  },
}
