import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { useMatch } from '../state/match'
import { players } from '../data/mock'
import { RankDelta } from '../components/RankDelta'

export default function MatchResult(){
  const nav = useNavigate()
  const { currentPlayerId } = useAuth()
  const { state, dispatch } = useMatch()
  const me = players.find(p=>p.id===currentPlayerId) ?? players[0]
  const opp = state.draft.opponent ?? players[1]
  const r = state.result

  return (
    <div className="container">
      <div className="card vstack">
        <h2 style={{marginTop:0}}>Result</h2>
        <div className="grid">
          <div className="col-4">
            <div className="card vstack">
              <div className="small muted">Final</div>
              <div style={{fontSize:24, fontWeight:800}}>{r.userScore} — {r.oppScore}</div>
              <div className="small muted">{me.name} vs {opp.name}</div>
            </div>
          </div>
          <div className="col-4">
            {r.ratingBefore !== null && r.ratingAfter !== null ? (
              <RankDelta before={r.ratingBefore} after={r.ratingAfter} />
            ) : null}
          </div>
          <div className="col-4">
            {r.rankBefore !== null && r.rankAfter !== null ? (
              <div className="card vstack" style={{alignItems:'center'}}>
                <div className="small muted">Rank</div>
                <div style={{fontSize:32, fontWeight:800}}>#{r.rankAfter}</div>
                <div className="small" style={{color: (r.rankAfter <= (r.rankBefore ?? 0)) ? 'var(--success)' : 'var(--danger)'}}>
                  {(r.rankAfter <= (r.rankBefore ?? 0)) ? '▲' : '▼'} {(r.rankBefore ?? 0) - (r.rankAfter ?? 0)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="hstack" style={{justifyContent:'flex-end', gap:8}}>
          <Link className="btn" to="/rankings">View Rankings</Link>
          <button className="btn primary" onClick={()=>{ dispatch({type:'reset'}); nav('/match/setup') }}>Play again</button>
        </div>
      </div>
    </div>
  )
}
