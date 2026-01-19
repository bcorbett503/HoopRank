import { NavBar } from './components/NavBar'
import { Footer } from './components/Footer'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Rankings from './pages/Rankings'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import Matches from './pages/Matches'
import About from './pages/About'
import Login from './pages/Login'
import PlayLanding from './pages/PlayLanding'
import MatchSetup from './pages/MatchSetup'
import MatchMap from './pages/MatchMap'
import MatchLive from './pages/MatchLive'
import MatchScore from './pages/MatchScore'
import MatchResult from './pages/MatchResult'
import ProfileSetup from './pages/ProfileSetup'
import { AuthProvider, useAuth } from './state/auth'
import { MatchProvider } from './state/match'

function RequireAuth({ children }:{ children: JSX.Element }){
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to={'/login'} state={{ from: loc.pathname }} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <MatchProvider>
        <div style={{minHeight:'100vh', display:'flex', flexDirection:'column'}}>
          <NavBar />
          <main style={{flex:1}}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play" element={<RequireAuth><PlayLanding /></RequireAuth>} />
              <Route path="/match/setup" element={<RequireAuth><MatchSetup /></RequireAuth>} />
              <Route path="/match/map" element={<RequireAuth><MatchMap /></RequireAuth>} />
              <Route path="/match/live" element={<RequireAuth><MatchLive /></RequireAuth>} />
              <Route path="/match/score" element={<RequireAuth><MatchScore /></RequireAuth>} />
              <Route path="/match/result" element={<RequireAuth><MatchResult /></RequireAuth>} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/players" element={<Players />} />
              <Route path="/players/:slug" element={<PlayerDetail />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile/setup" element={<RequireAuth><ProfileSetup /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </MatchProvider>
    </AuthProvider>
  )
}
