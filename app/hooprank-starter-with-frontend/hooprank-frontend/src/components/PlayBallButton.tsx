import React from 'react'

export function PlayBallButton({ onClick }:{ onClick:()=>void }) {
  return (
    <button className="playball" onClick={onClick} aria-label="Play">
      <span className="sr-only">Play</span>
      🏀
    </button>
  )
}
