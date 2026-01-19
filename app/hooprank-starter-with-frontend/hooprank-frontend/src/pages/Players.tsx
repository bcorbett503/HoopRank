import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Player } from '../types'
import { Link } from 'react-router-dom'
import { initials } from '../utils/format'

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([])
  const [q, setQ] = useState('')

  useEffect(()=>{ api.listPlayers({ search:q }).then(setPlayers) }, [q])

  return (
    <div className="container">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Players</h2>
        <input placeholder="Search players..." value={q} onChange={e=>setQ(e.target.value)} />
      </div>
      <div style={{height:16}}/>
      <div className="grid">
        {players.map(p => (
          <div key={p.id} className="col-6">
            <Link to={`/players/${p.slug}`} className="card" style={{display:'block'}}>
              <div className="hstack" style={{justifyContent:'space-between'}}>
                <div className="hstack">
                  <div className="avatar" aria-hidden="true">{initials(p.name)}</div>
                  <div>
                    <div style={{fontWeight:700}}>{p.name}</div>
                    <div className="small muted">{p.team} • {p.position}</div>
                    <div className="small muted">ZIP {p.zip ?? '—'}</div>
                  </div>
                </div>
                <div className="badge"><span className="small muted">HoopRank</span> <strong>{p.rating.toFixed(2)}</strong></div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
