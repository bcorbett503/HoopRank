import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { players } from '../data/mock'
import type { Player } from '../types'
import { useAuth } from '../state/auth'
import { useMatch } from '../state/match'
import { HardwoodButton } from '../components/HardwoodButton'
import { QRGenerator } from '../components/QR'

function FriendPicker({ currentId, onPick }:{ currentId: string, onPick:(p:Player)=>void }){
  const friends = players.filter(p => p.id !== currentId).slice(0, 12)
  const [q, setQ] = useState('')
  const shown = friends.filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="vstack">
      <input placeholder="Search friends..." value={q} onChange={e=>setQ(e.target.value)} />
      <div className="grid">
        {shown.map(f => (
          <div key={f.id} className="col-6">
            <button className="card btn block" onClick={()=>onPick(f)}>
              <div style={{fontWeight:600}}>{f.name}</div>
              <div className="small muted">{f.team} • {f.position} • ZIP {f.zip ?? '—'}</div>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MatchSetup(){
  const nav = useNavigate()
  const { currentPlayerId } = useAuth()
  const { state, dispatch } = useMatch()
  const me = players.find(p => p.id === currentPlayerId) ?? players[0]

  const [tab, setTab] = useState<'friends'|'qr'>('friends')

  const inviteCode = useMemo(()=>{
    const seed = Math.random().toString(36).slice(2,8)
    return `match:${seed}:${me.id}`
  }, [me.id])

  const canStart = !!state.draft.opponent // court optional

  const pickCourt = () => nav('/match/map')

  return (
    <div className="container">
      <div className="grid">
        <div className="col-8">
          <div className="card vstack">
            <h2 style={{margin:0}}>Set up your match</h2>
            <div className="small muted">Mode: 1 v 1 (only)</div>
            <div className="divider" />
            <div className="hstack" role="tablist">
              <button className={tab==='friends'?'btn':'btn ghost'} onClick={()=>setTab('friends')} role="tab" aria-selected={tab==='friends'}>Choose from friends</button>
              <button className={tab==='qr'?'btn':'btn ghost'} onClick={()=>setTab('qr')} role="tab" aria-selected={tab==='qr'}>Connect via QR</button>
            </div>
            {tab==='friends' ? (
              <FriendPicker currentId={me.id} onPick={(p)=>dispatch({type:'setOpponent', opponent:p})} />
            ) : (
              <div className="grid">
                <div className="col-6">
                  <div className="card vstack" style={{alignItems:'center'}}>
                    <div style={{fontWeight:600}}>Your invite</div>
                    <div className="small muted">Have your opponent scan this</div>
                    <QRGenerator text={inviteCode} />
                    <div className="small muted">Code: <span className="kbd">{inviteCode}</span></div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="card vstack">
                    <div style={{fontWeight:600}}>Scan opponent</div>
                    <div className="small muted">Paste their code to connect</div>
                    <input placeholder="Paste invite code..." onChange={e=>{
                      const val = e.target.value.trim()
                      if (val.startsWith('match:')) {
                        const parts = val.split(':')
                        const pid = parts[2]
                        const opp = players.find(p=>p.id===pid)
                        if (opp) dispatch({ type:'setOpponent', opponent: opp })
                      }
                    }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="col-4">
          <div className="card vstack">
            <div className="small muted">You</div>
            <div style={{fontWeight:700}}>{me.name}</div>
            <div className="divider" />
            <div className="small muted">Opponent</div>
            <div style={{minHeight:24}}>{state.draft.opponent ? <strong>{state.draft.opponent.name}</strong> : '— not selected'}</div>
            <div className="divider" />
            <div className="small muted">Court (optional)</div>
            {state.draft.court ? (
              <div>
                <div><strong>{state.draft.court.name}</strong></div>
                <div className="small muted">{state.draft.court.address}</div>
              </div>
            ) : (
              <button className="btn" onClick={pickCourt}>Choose court</button>
            )}
            <div style={{height:12}}/>
            <HardwoodButton
              disabled={!canStart}
              onClick={()=>{ dispatch({type:'start'}); nav('/match/live'); }}
            >
              Start Game
            </HardwoodButton>
          </div>
        </div>
      </div>
    </div>
  )
}
