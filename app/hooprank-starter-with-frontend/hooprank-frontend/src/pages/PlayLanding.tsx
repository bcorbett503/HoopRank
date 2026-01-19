import React from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayBallButton } from '../components/PlayBallButton'

export default function PlayLanding(){
  const nav = useNavigate()
  return (
    <div className="container" style={{display:'grid', placeItems:'center', minHeight:'60vh'}}>
      <div className="vstack" style={{alignItems:'center', gap:16}}>
        <h1 style={{textAlign:'center', margin:0}}>Ready to hoop?</h1>
        <p className="muted" style={{textAlign:'center'}}>Tap the ball to set up a 1 v 1.</p>
        <PlayBallButton onClick={()=>nav('/match/setup')} />
      </div>
    </div>
  )
}
