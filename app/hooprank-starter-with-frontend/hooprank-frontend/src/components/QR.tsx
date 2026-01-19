import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export function QRGenerator({ text }:{ text:string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(()=>{
    if (!ref.current) return
    QRCode.toCanvas(ref.current, text, { width: 180 }, (err)=>{
      if (err) console.error(err)
      try { setDataUrl(ref.current?.toDataURL() ?? null) } catch {}
    })
  }, [text])

  return (
    <div className="vstack" style={{alignItems:'center'}}>
      <canvas ref={ref} aria-label="Your QR code"></canvas>
      {dataUrl && <a className="small muted" href={dataUrl} download="hooprank-invite.png">Download</a>}
    </div>
  )
}
