export type Position = 'G' | 'F' | 'C'

export interface Player {
  id: string
  slug: string
  name: string
  team: string
  position: Position
  age: number
  height: string
  weight: string
  zip?: string
  rating: number // HoopRank 1–5
  offense: number
  defense: number
  shooting: number
  passing: number
  rebounding: number
}

export interface Match {
  id: string
  challengerId: string
  opponentId: string
  status: 'pending' | 'accepted' | 'completed'
  scheduledAt?: string
  location?: string
  winnerId?: string
  ratingDelta?: number // 1–5 scale deltas (e.g., 0.12)
}

export interface Api {
  listPlayers(query?: { search?: string, position?: Position | 'ALL', sort?: string }): Promise<Player[]>
  getPlayerBySlug(slug: string): Promise<Player | undefined>
  listMatches(): Promise<Match[]>
  acceptMatch(id: string): Promise<Match>
  completeMatch(id: string): Promise<{ match: Match, provisionalDelta: number }>
}

export type AuthProvider = 'google' | 'facebook'

export interface User {
  id: string
  name: string
  provider: AuthProvider
  playerId: string
}

export interface Court {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
}
