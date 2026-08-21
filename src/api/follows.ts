import client from './client'
import type { FollowRelationship, PaginatedResponse, User } from '@/types'

/**
 * A person in a follow list, carrying the viewer's tie to them.
 *
 * The full relationship, not the three edge fields it used to be: without
 * `can_follow` the client had to guess at it, and guessing at an authorization
 * answer meant offering a Follow button that the server then refused.
 */
export interface FollowListUser extends User {
  relationship?: FollowRelationship
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
