import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { players } from '../data/mock'
import { getProfile } from '../state/profile'

export default function Login(){
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as any
  const next = loc.state?.from ?? '/'

  const [playerId, setPlayerId] = useState(players[0].id)

  const doLogin = (provider:'google'|'facebook') => {
    login(provider, playerId)
    const prof = getProfile(playerId)
    if (!prof) nav('/profile/setup')
    else nav(next)
  }

  return (
    <div className="container">
      <div className="card vstack" style={{maxWidth:520, margin:'32px auto'}}>
        <h2>Sign in</h2>
        <p className="muted">Mock auth for local demo. Pick a player identity to associate with your account.</p>
        <label className="small muted">Your player identity</label>
        <select value={playerId} onChange={e=>setPlayerId(e.target.value)}>
          {players.map(p => <option key={p.id} value={p.id}>{p.name} — {p.team}</option>)}
        </select>
        <div className="hstack" style={{gap:12, marginTop:12}}>
          <button className="btn" onClick={()=>doLogin('google')}>
            <span aria-hidden>🔵</span> Continue with Google
          </button>
          <button className="btn" onClick={()=>doLogin('facebook')}>
            <span aria-hidden>🔷</span> Continue with Facebook
          </button>
        </div>
      </div>
    </div>
  )
}
