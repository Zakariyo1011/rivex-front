import client from './client'
import type { FollowRelationship, PaginatedResponse, User } from '@/types'

/** A person in a follow list, carrying the viewer's tie to them. */
export interface FollowListUser extends User {
  relationship?: Pick<FollowRelationship, 'is_following' | 'follow_status' | 'is_followed_by'>
}

export const followsApi = {
  follow(userId: number) {
    return client.post<{ data: FollowRelationship; message: string }>(
      `/users/${userId}/follow`,
    )
  },
  unfollow(userId: number) {
    return client.delete<{ data: FollowRelationship; message: string }>(
      `/users/${userId}/follow`,
    )
  },

  followers(userId: number, page = 1) {
    return client.get<PaginatedResponse<FollowListUser>>(`/users/${userId}/followers`, {
      params: { page },
    })
  },
  following(userId: number, page = 1) {
    return client.get<PaginatedResponse<FollowListUser>>(`/users/${userId}/following`, {
      params: { page },
    })
  },

  /** The caller's own incoming requests. There is no route for anyone else's. */
  requests(page = 1) {
    return client.get<PaginatedResponse<FollowListUser>>('/me/follow-requests', {
      params: { page },
    })
  },
  accept(userId: number) {
    return client.post<{ message: string }>(`/users/${userId}/follow/accept`)
  },
  reject(userId: number) {
    return client.post<{ message: string }>(`/users/${userId}/follow/reject`)
  },
  removeFollower(userId: number) {
    return client.delete<{ message: string }>(`/me/followers/${userId}`)
  },
}
