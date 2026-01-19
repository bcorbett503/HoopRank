import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatch } from '../state/match'
import { HardwoodButton } from '../components/HardwoodButton'

export default function MatchLive(){
  const { state, dispatch } = useMatch()
  const nav = useNavigate()

  useEffect(()=>{
    const id = setInterval(()=> dispatch({type:'tick'}), 1000)
    return ()=> clearInterval(id)
  }, [dispatch])

  return (
    <div className="container">
      <div className="card vstack" style={{alignItems:'center'}}>
        <div className="small muted">Timer</div>
        <div style={{fontSize:48, fontWeight:800}}>
          {String(Math.floor(state.live.seconds/60)).padStart(2,'0')}:
          {String(state.live.seconds%60).padStart(2,'0')}
        </div>
        <HardwoodButton onClick={()=>{ dispatch({type:'end'}); nav('/match/score') }}>
          End Game
        </HardwoodButton>
      </div>
    </div>
  )
}
