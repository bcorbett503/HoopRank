import type { Player, Match } from '../types'
import { slugify } from '../utils/format'

// WNBA-only mock player set (amateur app demo uses 1–5 HoopRank scale)
const playersRaw = [
  { name: "A'ja Wilson", team: 'Aces', position: 'F', age: 28, height:'6\'4"', weight:'195 lb', zip:'89101', rating: 4.9, offense: 4.7, defense: 5.0, shooting: 4.6, passing: 4.0, rebounding: 5.0 },
  { name: 'Breanna Stewart', team: 'Liberty', position: 'F', age: 31, height:'6\'4"', weight:'170 lb', zip:'10001', rating: 4.7, offense: 4.6, defense: 4.9, shooting: 4.6, passing: 4.3, rebounding: 4.7 },
  { name: 'Sabrina Ionescu', team: 'Liberty', position: 'G', age: 27, height:'5\'11"', weight:'165 lb', zip:'10001', rating: 4.6, offense: 4.7, defense: 4.0, shooting: 4.8, passing: 4.6, rebounding: 3.6 },
  { name: 'Alyssa Thomas', team: 'Sun', position: 'F', age: 32, height:'6\'2"', weight:'185 lb', zip:'06103', rating: 4.5, offense: 4.3, defense: 4.9, shooting: 4.1, passing: 4.7, rebounding: 4.6 },
  { name: 'Caitlin Clark', team: 'Fever', position: 'G', age: 23, height:'6\'0"', weight:'155 lb', zip:'46204', rating: 4.3, offense: 4.6, defense: 3.5, shooting: 4.9, passing: 4.6, rebounding: 3.1 },
  { name: 'Aliyah Boston', team: 'Fever', position: 'C', age: 23, height:'6\'5"', weight:'220 lb', zip:'46204', rating: 4.3, offense: 4.1, defense: 4.6, shooting: 4.1, passing: 3.8, rebounding: 4.8 },
  { name: 'Kelsey Plum', team: 'Aces', position: 'G', age: 30, height:'5\'8"', weight:'145 lb', zip:'89101', rating: 4.4, offense: 4.6, defense: 3.6, shooting: 4.7, passing: 4.3, rebounding: 2.8 },
  { name: 'Ariel Atkins', team: 'Mystics', position: 'G', age: 28, height:'5\'10"', weight:'167 lb', zip:'20001', rating: 4.0, offense: 4.0, defense: 4.5, shooting: 4.3, passing: 4.0, rebounding: 3.0 }
]

export const players = playersRaw.map((p, idx) => ({
  id: String(idx+1),
  slug: slugify(p.name),
  ...p
})) satisfies Player[]

// WNBA-only mock matches
export const matches: Match[] = [
  { id: 'm1', challengerId: players[0].id, opponentId: players[1].id, status: 'pending',  scheduledAt: new Date(Date.now()+86400000).toISOString(), location: 'Downtown Gym' },
  { id: 'm2', challengerId: players[2].id, opponentId: players[3].id, status: 'accepted', scheduledAt: new Date(Date.now()+2*86400000).toISOString(), location: 'Practice Court' },
  { id: 'm3', challengerId: players[4].id, opponentId: players[6].id, status: 'completed', scheduledAt: new Date(Date.now()-86400000).toISOString(), location: 'Community Center', winnerId: players[4].id, ratingDelta: 0.12 },
]
