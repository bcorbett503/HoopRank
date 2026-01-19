import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Player, Position } from '../types'
import Search from '../components/Search'
import Segmented from '../components/Segmented'
import { Link } from 'react-router-dom'
import { initials } from '../utils/format'

type SortKey = 'rating'|'offense'|'defense'|'shooting'|'passing'|'rebounding'|'age'|'name'|'zip'|'height'

export default function Rankings() {
  const [players, setPlayers] = useState<Player[]>([])
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<Position | 'ALL'>('ALL')
  const [sort, setSort] = useState<{ key: SortKey, dir:'asc'|'desc' }>({key:'rating', dir:'desc'})

  useEffect(()=>{
    api.listPlayers({ search, position, sort: `${sort.key}:${sort.dir}` }).then(setPlayers)
  },[search, position, sort])

  const headers: {key:SortKey,label:string,align?:'left'|'right'}[] = [
    { key:'name', label:'Player' },
    { key:'team', label:'Team' },
    { key:'zip', label:'ZIP' },
    { key:'height', label:'Ht' },
    { key:'position', label:'Pos' },
    { key:'age', label:'Age', align:'right' },
    { key:'rating', label:'HoopRank', align:'right' },
    { key:'offense', label:'Off', align:'right' },
    { key:'defense', label:'Def', align:'right' },
    { key:'shooting', label:'Shoot', align:'right' },
    { key:'passing', label:'Pass', align:'right' },
    { key:'rebounding', label:'Reb', align:'right' },
  ] as any

  const onSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir:'desc' })
  }

  return (
    <div className="container">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Rankings</h2>
        <div className="small muted">Amateur 1–5 scale • ZIP-aware • WNBA-only mock</div>
      </div>
      <div style={{height:12}}/>
      <div className="hstack" style={{justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
        <Search value={search} onChange={setSearch} placeholder="Search by name, team, or ZIP..." />
        <Segmented options={[
          {label:'All', value:'ALL'},
          {label:'G', value:'G'},
          {label:'F', value:'F'},
          {label:'C', value:'C'},
        ]} value={position} onChange={setPosition} />
      </div>
      <div style={{height:16}} />
      <div className="card">
        <table className="table" role="table">
          <thead>
            <tr>
              <th>#</th>
              {headers.map(h => (
                <th key={h.key} onClick={()=>onSort(h.key)} style={{cursor:'pointer', textAlign:h.align||'left'}}>
                  {h.label} {(sort.key===h.key) ? (sort.dir==='asc'?'▲':'▼') : ''}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p,i)=> (
              <tr key={p.id}>
                <td className="small muted">{i+1}</td>
                <td>
                  <Link to={`/players/${p.slug}`} className="hstack">
                    <div className="avatar" aria-hidden="true">{initials(p.name)}</div>
                    <div style={{fontWeight:600}}>{p.name}</div>
                  </Link>
                </td>
                <td className="muted">{p.team}</td>
                <td>{p.zip ?? '—'}</td>
                <td>{p.height}</td>
                <td>{p.position}</td>
                <td style={{textAlign:'right'}}>{p.age}</td>
                <td style={{textAlign:'right'}}><strong>{p.rating.toFixed(2)}</strong></td>
                <td style={{textAlign:'right'}}>{p.offense.toFixed(1)}</td>
                <td style={{textAlign:'right'}}>{p.defense.toFixed(1)}</td>
                <td style={{textAlign:'right'}}>{p.shooting.toFixed(1)}</td>
                <td style={{textAlign:'right'}}>{p.passing.toFixed(1)}</td>
                <td style={{textAlign:'right'}}>{p.rebounding.toFixed(1)}</td>
                <td style={{textAlign:'right'}}><Link to={`/players/${p.slug}`} className="btn small">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
