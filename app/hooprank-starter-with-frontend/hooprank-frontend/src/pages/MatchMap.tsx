import React from 'react'
import { useNavigate } from 'react-router-dom'
import CourtPicker from '../components/CourtPicker'
import { useMatch } from '../state/match'

export default function MatchMap(){
  const { dispatch } = useMatch()
  const nav = useNavigate()
  return (
    <div className="container">
      <div className="card vstack">
        <h2 style={{margin:0}}>Pick a court</h2>
        <p className="muted small">Optional step. You can also skip.</p>
        <CourtPicker onPick={(c)=>{ dispatch({type:'setCourt', court:c}); nav('/match/setup') }} />
        <div className="hstack" style={{justifyContent:'flex-end'}}>
          <button className="btn" onClick={()=>nav('/match/setup')}>Skip</button>
        </div>
      </div>
    </div>
  )
}
