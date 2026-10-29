import { http } from '../../lib/http'

export interface MyProfile {
  id: string
  email: string
  name: string
  phone: string | null
  bio: string | null
  profilePhotoUrl: string | null
  role: 'USER' | 'ADMIN'
  isHost: boolean
  createdAt: string
}

export interface ProfileUpdate {
  name?: string
  phone?: string | null
  bio?: string | null
}

export interface ProfileReview {
  id: string
  authorName: string
  spaceName: string
  rating: number
  comment: string | null
  createdAt: string
}

export interface PublicProfile {
  id: string
  name: string
  bio: string | null
  profilePhotoUrl: string | null
  createdAt: string
  reviewCount: number
  averageRating: number | null
  reviews: ProfileReview[]
}

export function fetchMyProfile(signal?: AbortSignal) {
  return http.get<MyProfile>('/users/me', { signal })
}

export function updateProfile(input: ProfileUpdate) {
  return http.patch<MyProfile>('/users/me', input)
}

export function uploadProfilePhoto(file: File) {
  const form = new FormData()
  form.append('file', file)
  return http.post<MyProfile>('/users/me/photo', form)
}

export function removeProfilePhoto() {
  return http.delete<MyProfile>('/users/me/photo')
}

export function fetchPublicProfile(id: string, signal?: AbortSignal) {
  return http.get<PublicProfile>(`/users/${encodeURIComponent(id)}/profile`, { signal })
}
