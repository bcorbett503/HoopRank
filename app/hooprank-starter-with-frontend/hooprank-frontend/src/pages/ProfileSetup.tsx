import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import type { Position } from '../types'
import { getProfile, saveProfile, applyProfileToPlayer } from '../state/profile'
import { players } from '../data/mock'

export default function ProfileSetup(){
  const nav = useNavigate()
  const { currentPlayerId } = useAuth()
  const me = players.find(p=>p.id===currentPlayerId) ?? players[0]

  const existing = currentPlayerId ? getProfile(currentPlayerId) : null

  const [age, setAge] = useState<number>(existing?.age ?? me.age ?? 18)
  const [zip, setZip] = useState<string>(existing?.zip ?? (me.zip ?? ''))
  const [ft, setFt] = useState<number>(existing?.heightFt ?? Number((me.height||"6'0"").split("'")[0]) || 6)
  const [inch, setInch] = useState<number>(existing?.heightIn ?? Number(((me.height||"6'0\"").split("'")[1]||'0').replace('"','')) || 0)
  const [pos, setPos] = useState<Position>(existing?.position ?? me.position ?? 'G')

  const zipValid = /^[0-9]{5}$/.test(zip)
  const ageValid = age >= 13 && age <= 65
  const ftValid = ft >= 4 && ft <= 7
  const inchValid = inch >= 0 && inch <= 11

  const canSave = zipValid && ageValid && ftValid && inchValid && !!currentPlayerId

  const save = () => {
    if (!currentPlayerId || !canSave) return
    const data = { age, zip, heightFt: ft, heightIn: inch, position: pos }
    saveProfile(currentPlayerId, data)
    applyProfileToPlayer(currentPlayerId, data)
    nav('/play')
  }

  return (
    <div className="container">
      <div className="card vstack" style={{maxWidth:640, margin:'24px auto'}}>
        <h2 style={{marginTop:0}}>Set up your profile</h2>
        <p className="muted small">We use this to place you on local leaderboards. You can change it later.</p>

        <label className="small muted">Age</label>
        <input type="number" min={13} max={65} value={age} onChange={e=>setAge(Number(e.target.value))} />

        <label className="small muted">ZIP Code</label>
        <input value={zip} onChange={e=>setZip(e.target.value)} placeholder="e.g. 94103" />
        {!zipValid && <div className="small" style={{color:'var(--danger)'}}>Enter a valid 5‑digit ZIP.</div>}

        <div className="grid">
          <div className="col-6">
            <label className="small muted">Height (ft)</label>
            <input type="number" min={4} max={7} value={ft} onChange={e=>setFt(Number(e.target.value))}/>
          </div>
          <div className="col-6">
            <label className="small muted">Height (in)</label>
            <input type="number" min={0} max={11} value={inch} onChange={e=>setInch(Number(e.target.value))}/>
          </div>
        </div>

        <label className="small muted">Position</label>
        <div className="hstack">
          {(['G','F','C'] as Position[]).map(p => (
            <button key={p} className={p===pos?'btn':'btn ghost'} onClick={()=>setPos(p)}>{p}</button>
          ))}
        </div>

        <div className="hstack" style={{justifyContent:'flex-end', marginTop:8}}>
          <button className="btn primary" onClick={save} disabled={!canSave}>Save & Continue</button>
        </div>
      </div>
    </div>
  )
}
