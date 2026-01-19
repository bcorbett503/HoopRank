import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Player } from '../types'
import { initials } from '../utils/format'
import { PlayBallButton } from '../components/PlayBallButton'

export default function Home() {
  const [top, setTop] = useState<Player[]>([])
  useEffect(()=>{ api.listPlayers({}).then(players => setTop(players.slice(0,5))) },[])

  return (
    <div className="container">
      <section className="hero">
        <div className="vstack" style={{alignItems:'center', gap:12}}>
          <PlayBallButton onClick={()=>window.location.assign('/play')} />
          <div className="small muted">Tap to start a 1 v 1</div>
        </div>
      </section>
      <section className="hero">
        <div className="grid">
          <div className="col-8">
            <h1>Social hoops for amateurs, ranked <span style={{color:'var(--brand-600)'}}>1–5</span>.</h1>
            <p>Track your HoopRank, play 1 v 1s with friends, and climb local leaderboards.</p>
            <div style={{height:16}}/>
            <div className="hstack">
              <Link to="/rankings" className="btn">Explore Rankings</Link>
              <Link to="/players" className="btn">Browse Players</Link>
            </div>
          </div>
          <div className="col-4">
            <div className="card">
              <div className="hstack" style={{justifyContent:'space-between'}}>
                <strong>🔥 Top 5</strong>
                <Link to="/rankings" className="small muted">See all →</Link>
              </div>
              <div className="divider" />
              <div className="vstack">
                {top.map((p,i)=> (
                  <Link key={p.id} to={`/players/${p.slug}`} className="hstack" style={{justifyContent:'space-between'}}>
                    <div className="hstack">
                      <div className="avatar" aria-hidden="true">{initials(p.name)}</div>
                      <div>
                        <div style={{fontWeight:600}}>{i+1}. {p.name}</div>
                        <div className="small muted">{p.team} • {p.position}</div>
                      </div>
                    </div>
                    <div className="hstack">
                      <div className="badge" aria-label="HoopRank">
                        <span className="small muted">HoopRank</span> <strong>{p.rating.toFixed(2)}</strong>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="divider" />
              <div className="small muted">WNBA-only mock data • 1–5 scale.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
