import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { useMatch } from '../state/match'
import { players } from '../data/mock'
import { HardwoodButton } from '../components/HardwoodButton'

function calcDelta(selfRating:number, oppRating:number, selfScore:number, oppScore:number){
  const diff = selfRating - oppRating
  const base = 0.35
  const swing = Math.max(0.05, base - Math.min(0.25, Math.abs(diff)/5))
  const margin = Math.max(0, Math.min(10, Math.abs(selfScore - oppScore)))
  const marginBoost = Math.min(0.15, margin * 0.02)
  const won = selfScore > oppScore
  const delta = Number((swing + marginBoost).toFixed(2))
  return won ? delta : -delta
}

export default function MatchScore(){
  const nav = useNavigate()
  const { currentPlayerId } = useAuth()
  const { state, dispatch } = useMatch()
  const me = players.find(p=>p.id===currentPlayerId) ?? players[0]
  const opp = state.draft.opponent ?? players[1]

  const [left, setLeft] = useState<string>('')
  const [right, setRight] = useState<string>('')

  const leftNum = Number(left)
  const rightNum = Number(right)
  const canSubmit = Number.isFinite(leftNum) && Number.isFinite(rightNum) && left !== '' && right !== ''

  const submit = () => {
    if (!canSubmit) return
    dispatch({ type:'setScores', userScore: leftNum, oppScore: rightNum })
    const delta = calcDelta(me.rating, opp.rating, leftNum, rightNum)
    const byRatingDesc = (a:any,b:any)=> b.rating - a.rating
    const sortedBefore = [...players].sort(byRatingDesc)
    const rankBefore = sortedBefore.findIndex(p=>p.id===me.id) + 1
    const ratingAfter = Number((me.rating + delta).toFixed(2))
    const oppAfter = Number((opp.rating - delta).toFixed(2))
    const sortedAfter = [...players.map(p => p.id===me.id ? { ...p, rating: ratingAfter } : (p.id===opp.id ? { ...p, rating: oppAfter } : p))].sort(byRatingDesc)
    const rankAfter = sortedAfter.findIndex(p=>p.id===me.id) + 1
    dispatch({ type:'setOutcome', delta, ratingBefore: me.rating, ratingAfter, rankBefore, rankAfter })
    nav('/match/result')
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{marginTop:0}}>Enter the final score</h2>
        <div className="grid">
          <div className="col-6">
            <div className="card vstack">
              <div className="small muted">You</div>
              <div style={{fontWeight:700}}>{me.name}</div>
              <input type="number" min={0} value={left} onChange={e=>setLeft(e.target.value)} placeholder="Your score" />
            </div>
          </div>
          <div className="col-6">
            <div className="card vstack">
              <div className="small muted">Opponent</div>
              <div style={{fontWeight:700}}>{opp.name}</div>
              <input type="number" min={0} value={right} onChange={e=>setRight(e.target.value)} placeholder="Opponent score" />
            </div>
          </div>
        </div>
        <div className="hstack" style={{justifyContent:'flex-end'}}>
          <HardwoodButton onClick={submit} disabled={!canSubmit}>Submit Score</HardwoodButton>
        </div>
      </div>
    </div>
  )
}
