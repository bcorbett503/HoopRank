import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User, AuthProvider } from '../types'
import { players } from '../data/mock'

interface AuthContextShape {
  user: User | null
  login: (provider: AuthProvider, playerId?: string) => void
  logout: () => void
  currentPlayerId: string | null
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('hooprank:user')
    if (raw) setUser(JSON.parse(raw))
  }, [])

  const login = (provider: AuthProvider, playerId?: string) => {
    const pid = playerId ?? players[0].id
    const u: User = {
      id: 'u-' + pid,
      name: provider === 'google' ? 'Google User' : 'Facebook User',
      provider,
      playerId: pid
    }
    setUser(u)
    localStorage.setItem('hooprank:user', JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('hooprank:user')
  }

  const value = useMemo(() => ({
    user,
    login,
    logout,
    currentPlayerId: user?.playerId ?? null
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
