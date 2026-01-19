import type { Api, Player, Match, Position } from '../types'
import { players as MOCK_PLAYERS, matches as MOCK_MATCHES } from '../data/mock'

const sleep = (ms:number) => new Promise(res=>setTimeout(res, ms))

class MockApi implements Api {
  async listPlayers(query?: { search?: string, position?: Position | 'ALL', sort?: string }): Promise<Player[]> {
    await sleep(120)
    let res = [...MOCK_PLAYERS]
    if (query?.search) {
      const q = query.search.toLowerCase()
      res = res.filter(p => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || (p.zip||'').includes(q))
    }
    if (query?.position && query.position !== 'ALL') res = res.filter(p => p.position === query.position)
    if (query?.sort) {
      const [key, dir] = query.sort.split(':')
      res.sort((a:any,b:any)=> (a[key] ?? 0) > (b[key] ?? 0) ? 1 : -1)
      if (dir === 'desc') res.reverse()
    } else {
      res.sort((a,b)=> b.rating - a.rating)
    }
    return res
  }
  async getPlayerBySlug(slug: string): Promise<Player | undefined> {
    await sleep(80)
    return MOCK_PLAYERS.find(p => p.slug === slug)
  }
  async listMatches(): Promise<Match[]> {
    await sleep(100)
    return [...MOCK_MATCHES]
  }
  async acceptMatch(id: string): Promise<Match> {
    await sleep(80)
    const m = MOCK_MATCHES.find(m=>m.id===id)
    if (!m) throw new Error('Match not found')
    m.status = 'accepted'
    return m
  }
  async completeMatch(id: string): Promise<{ match: Match; provisionalDelta: number; }> {
    await sleep(100)
    const m = MOCK_MATCHES.find(m=>m.id===id)
    if (!m) throw new Error('Match not found')
    m.status = 'completed'
    const challenger = MOCK_PLAYERS.find(p=>p.id===m.challengerId)!
    const opponent = MOCK_PLAYERS.find(p=>p.id===m.opponentId)!
    const diff = challenger.rating - opponent.rating
    const base = 0.35
    const swing = Math.max(0.05, base - Math.min(0.25, Math.abs(diff)/5))
    const margin = Math.random() * 10
    const marginBoost = Math.min(0.15, margin * 0.02)
    const delta = Number((swing + marginBoost).toFixed(2))
    m.winnerId = diff >= 0 ? m.challengerId : m.opponentId
    m.ratingDelta = delta
    return { match: m, provisionalDelta: delta }
  }
}

class HttpApi implements Api {
  constructor(private baseUrl: string) {}
  async listPlayers(): Promise<Player[]> {
    const res = await fetch(this.baseUrl + '/api/v1/players')
    if (!res.ok) throw new Error('Failed to fetch players')
    return await res.json()
  }
  async getPlayerBySlug(slug: string): Promise<Player | undefined> {
    const res = await fetch(this.baseUrl + '/api/v1/players/' + slug)
    if (!res.ok) throw new Error('Failed to fetch player')
    return await res.json()
  }
  async listMatches(): Promise<Match[]> {
    const res = await fetch(this.baseUrl + '/api/v1/matches')
    if (!res.ok) throw new Error('Failed to fetch matches')
    return await res.json()
  }
  async acceptMatch(id: string): Promise<Match> {
    const res = await fetch(this.baseUrl + `/api/v1/matches/${id}/accept`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to accept match')
    return await res.json()
  }
  async completeMatch(id: string): Promise<{ match: Match, provisionalDelta: number }> {
    const res = await fetch(this.baseUrl + `/api/v1/matches/${id}/complete`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to complete match')
    return await res.json()
  }
}

export const api: Api = (() => {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (base) return new HttpApi(base)
  return new MockApi()
})()
