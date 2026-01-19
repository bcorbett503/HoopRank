export default function About() {
  return (
    <div className="container">
      <div className="card vstack">
        <h2>About HoopRank (Frontend)</h2>
        <p>Social app for amateur 1v1 players on a 1–5 HoopRank scale. WNBA-only mock data; no backend required.</p>
        <pre><code>VITE_API_BASE_URL="http://localhost:3000"</code></pre>
        <p className="muted small">Switch the API client anytime; UI calls through a small abstraction.</p>
      </div>
    </div>
  )
}
