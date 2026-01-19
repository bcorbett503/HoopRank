export default function Segmented<T extends string>({ options, value, onChange }:{ options:{label:string, value:T}[], value:T, onChange:(v:T)=>void }){
  return (
    <div className="hstack" style={{border:'1px solid var(--border)', borderRadius:12, padding:4, background:'var(--bg-elev)'}} role="tablist" aria-label="Filter">
      {options.map(opt => (
        <button key={opt.value} className="btn" style={{padding:'6px 10px', borderRadius:8, background: value===opt.value ? 'var(--brand-600)' : 'transparent', color: value===opt.value ? 'white' : 'inherit', border:'none'}} onClick={()=>onChange(opt.value)} role="tab" aria-selected={value===opt.value}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
