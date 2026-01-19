import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Player } from '../types'
import Spark from '../components/Spark'
import { initials } from '../utils/format'

export default function PlayerDetail() {
  const { slug } = useParams()
  const [player, setPlayer] = useState<Player | null>(null)

  useEffect(()=>{ if (slug) api.getPlayerBySlug(slug).then(p=> setPlayer(p ?? null)) }, [slug])

  if (!player) return <div className="container"><div className="card">Loading...</div></div>

  const attrs = [
    {label:'Offense', key:'offense', value: player.offense},
    {label:'Defense', key:'defense', value: player.defense},
    {label:'Shooting', key:'shooting', value: player.shooting},
    {label:'Passing', key:'passing', value: player.passing},
    {label:'Rebounding', key:'rebounding', value: player.rebounding},
  ]

  return (
    <div className="container">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <div className="hstack">
          <div className="avatar" aria-hidden="true" style={{width:56, height:56, fontSize:20}}>{initials(player.name)}</div>
          <div>
            <h2 style={{margin:'0 0 4px 0'}}>{player.name}</h2>
            <div className="small muted">{player.team} • {player.position} • Age {player.age} • ZIP {player.zip ?? '—'}</div>
          </div>
        </div>
        <Link to="/rankings" className="btn">← Back</Link>
      </div>
      <div style={{height:16}}/>
      <div className="grid">
        <div className="col-8">
          <div className="card">
            <div className="hstack" style={{justifyContent:'space-between'}}>
              <strong>Overview</strong>
              <div className="badge"><span className="small muted">HoopRank</span> <strong>{player.rating.toFixed(2)}</strong></div>
            </div>
            <div className="divider" />
            <div className="grid">
              {attrs.map(a => (
                <div className="col-6" key={a.key}>
                  <div className="vstack">
                    <div className="hstack" style={{justifyContent:'space-between'}}>
                      <div className="muted small">{a.label}</div>
                      <div><strong>{a.value.toFixed(1)}</strong></div>
                    </div>
                    <div className="card">
                      <Spark points={[a.value-1, a.value-0.5, a.value, a.value+0.3, a.value]} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card vstack">
            <strong>Vitals</strong>
            <div className="divider" />
            <div className="hstack" style={{justifyContent:'space-between'}}><span className="muted">Height</span> <span>{player.height}</span></div>
            <div className="hstack" style={{justifyContent:'space-between'}}><span className="muted">Weight</span> <span>{player.weight}</span></div>
            <div className="hstack" style={{justifyContent:'space-between'}}><span className="muted">Position</span> <span>{player.position}</span></div>
            <div className="hstack" style={{justifyContent:'space-between'}}><span className="muted">ZIP</span> <span>{player.zip ?? '—'}</span></div>
            <div className="divider" />
            <button className="btn primary">Follow</button>
          </div>
        </div>
      </div>
    </div>
  )
}
