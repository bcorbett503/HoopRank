import React from 'react'
import clsx from 'clsx'

export function HardwoodButton({ children, disabled, onClick, className }:{ children: React.ReactNode, disabled?: boolean, onClick?: ()=>void, className?:string }){
  return (
    <button
      className={clsx('btn hardwood', className)}
      disabled={disabled}
      onClick={onClick}
      aria-disabled={disabled}
    >
      {children}
    </button>
  )
}
