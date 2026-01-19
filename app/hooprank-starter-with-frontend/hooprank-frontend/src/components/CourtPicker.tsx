import React from 'react'
import type { Court } from '../types'

const courts: Court[] = [
  { id: 'c1', name: 'Downtown Park Court', lat: 37.7749, lng: -122.4194, address: '123 Market St' },
  { id: 'c2', name: 'Riverside Hoops', lat: 37.78, lng: -122.41, address: '42 River Rd' },
  { id: 'c3', name: 'High School Gym', lat: 37.77, lng: -122.43, address: '500 Main Ave' },
]

export function listCourts() { return courts }

export default function CourtPicker({ onPick }:{ onPick:(c:Court)=>void }){
  return (
    <div className="grid">
      {courts.map(c => (
        <div key={c.id} className="col-6">
          <button className="card btn block" onClick={()=>onPick(c)} aria-label={`Pick ${c.name}`}>
            <div style={{fontWeight:600}}>{c.name}</div>
            <div className="small muted">{c.address}</div>
            <div className="mini-map" aria-hidden="true">
              <div className="pin" />
            </div>
          </button>
        </div>
      ))}
    </div>
  )
}
