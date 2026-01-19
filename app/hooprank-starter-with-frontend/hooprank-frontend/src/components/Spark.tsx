export default function Spark({ points }:{ points:number[] }) {
  if (!points || points.length === 0) return null
  const w = 100, h = 28, pad = 2
  const min = Math.min(...points), max = Math.max(...points)
  const scaleX = (i:number) => pad + i * (w - pad*2) / (points.length - 1)
  const scaleY = (v:number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad*2)
  const path = points.map((v,i)=> `${i===0?'M':'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ')
  const last = points[points.length-1]
  const first = points[0]
  const up = last >= first
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={path} fill="none" stroke='currentColor' strokeOpacity={0.9} strokeWidth="2" />
      <circle cx={scaleX(points.length-1)} cy={scaleY(last)} r="2.5" fill="currentColor"/>
    </svg>
  )
}
