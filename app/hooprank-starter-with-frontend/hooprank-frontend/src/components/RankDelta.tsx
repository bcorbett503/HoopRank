import React from 'react'

export function RankDelta({ before, after }:{ before:number, after:number }){
  const up = after >= before
  const delta = (after - before).toFixed(2)
  return (
    <div className="card vstack" style={{alignItems:'center'}}>
      <div className="small muted">HoopRank</div>
      <div style={{fontSize:32, fontWeight:800}}>{after.toFixed(2)} / 5</div>
      <div className="small" style={{color: up ? 'var(--success)' : 'var(--danger)'}}>
        {up ? '▲' : '▼'} {delta}
      </div>
    </div>
  )
}
