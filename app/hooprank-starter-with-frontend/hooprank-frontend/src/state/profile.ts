import type { Position } from '../types'
import { players } from '../data/mock'

export type ProfileData = {
  age: number
  zip: string
  heightFt: number
  heightIn: number
  position: Position
}

const key = (userId: string) => `hooprank:profile:${userId}`

export function getProfile(userId: string): ProfileData | null {
  const raw = localStorage.getItem(key(userId))
  if (!raw) return null
  try { return JSON.parse(raw) as ProfileData } catch { return null }
}

export function saveProfile(userId: string, data: ProfileData) {
  localStorage.setItem(key(userId), JSON.stringify(data))
}

export function applyProfileToPlayer(playerId: string, data: ProfileData) {
  const p = players.find(p => p.id === playerId)
  if (!p) return
  p.age = data.age
  p.position = data.position
  p.height = `${data.heightFt}'${data.heightIn}"`
  p.zip = data.zip
}
