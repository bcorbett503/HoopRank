import { useEffect, useState } from 'react'

export default function Search({ value, onChange, placeholder='Search players...' }:{ value:string, onChange:(v:string)=>void, placeholder?:string }) {
  const [v, setV] = useState(value)
  useEffect(()=> setV(value), [value])
  return (
    <div className="hstack" style={{gap:8}}>
      <div className="hstack card" style={{padding:'8px 10px'}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        <input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') onChange(v) }} placeholder={placeholder} style={{border:'none', outline:'none'}}/>
      </div>
      <button className="btn" onClick={()=>onChange(v)}>Search</button>
    </div>
  )
}
