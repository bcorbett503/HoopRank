import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Match, Player } from '../types'
import { Link } from 'react-router-dom'

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [playersById, setPlayersById] = useState<Record<string, Player>>({})

  useEffect(()=>{
    api.listMatches().then(setMatches)
    ;(async () => {
      const players = await api.listPlayers({})
      const map: Record<string, Player> = {}
      players.forEach(p => map[p.id] = p)
      setPlayersById(map)
    })()
  },[])

  const accept = async (id: string) => {
    const m = await api.acceptMatch(id)
    setMatches(prev => prev.map(x => x.id===id ? m : x))
  }

  const complete = async (id: string) => {
    const { match } = await api.completeMatch(id)
    setMatches(prev => prev.map(x => x.id===id ? match : x))
  }

  const label = (id:string) => playersById[id]?.name ?? '—'

  return (
    <div className="container">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Matches</h2>
        <div className="small muted">Prototype • Accept &amp; complete</div>
      </div>
      <div style={{height:12}}/>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Challenger</th>
              <th>Opponent</th>
              <th>Status</th>
              <th>When</th>
              <th>Location</th>
              <th>Winner</th>
              <th>Δ HoopRank</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id}>
                <td className="small muted">{m.id.slice(0,6)}</td>
                <td><Link to={`/players/${playersById[m.challengerId]?.slug ?? ''}`}>{label(m.challengerId)}</Link></td>
                <td><Link to={`/players/${playersById[m.opponentId]?.slug ?? ''}`}>{label(m.opponentId)}</Link></td>
                <td><span className="badge">{m.status}</span></td>
                <td>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : '—'}</td>
                <td>{m.location ?? '—'}</td>
                <td>{m.winnerId ? label(m.winnerId) : '—'}</td>
                <td>{m.ratingDelta ? <strong>{m.ratingDelta.toFixed(2)}</strong> : '—'}</td>
                <td className="hstack" style={{justifyContent:'flex-end'}}>
                  {m.status === 'pending' && <button className="btn" onClick={()=>accept(m.id)}>Accept</button>}
                  {m.status === 'accepted' && <button className="btn primary" onClick={()=>complete(m.id)}>Complete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
