import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { players } from '../data/mock'

export function NavBar() {
  const { user, logout, currentPlayerId } = useAuth()
  const me = players.find(p=>p.id===currentPlayerId)

  return (
    <div className="navbar">
      <div className="inner">
        <Link to="/" className="hstack" aria-label="HoopRank home">
          <img src="/logo.svg" alt="" width={120} height={30} />
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({isActive})=> isActive ? 'active' : undefined}>Home</NavLink>
          <NavLink to="/play" className={({isActive})=> isActive ? 'active' : undefined}>Play</NavLink>
          <NavLink to="/rankings" className={({isActive})=> isActive ? 'active' : undefined}>Rankings</NavLink>
          <NavLink to="/players" className={({isActive})=> isActive ? 'active' : undefined}>Players</NavLink>
          <NavLink to="/matches" className={({isActive})=> isActive ? 'active' : undefined}>Matches</NavLink>
          <NavLink to="/about" className={({isActive})=> isActive ? 'active' : undefined}>About</NavLink>
          <NavLink to="/profile/setup" className={({isActive})=> isActive ? 'active' : undefined}>Profile</NavLink>
        </nav>
        <div className="hstack">
          {user ? (
            <>
              <div className="badge">{me ? me.name : user.name}</div>
              <button className="btn" onClick={logout}>Log out</button>
            </>
          ) : (
            <Link className="btn primary" to="/login">Log in</Link>
          )}
        </div>
      </div>
    </div>
  )
}
