export function Footer() {
  return (
    <footer>
      <div className="container small">
        © {new Date().getFullYear()} HoopRank • Frontend prototype v0.3.1 • <span className="muted">WNBA-only mock data</span>
      </div>
    </footer>
  )
}
