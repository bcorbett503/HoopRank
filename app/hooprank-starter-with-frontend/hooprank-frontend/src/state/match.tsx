import React, { createContext, useContext, useMemo, useReducer } from 'react'
import type { Court, Player } from '../types'

type Mode = '1v1'

export interface MatchDraft {
  opponent: Player | null
  court: Court | null
  mode: Mode
}

export interface LiveState {
  startedAt: number | null
  seconds: number
  active: boolean
}

export interface ResultState {
  userScore: number | null
  oppScore: number | null
  delta: number | null
  ratingBefore: number | null
  ratingAfter: number | null
  rankBefore: number | null
  rankAfter: number | null
}

interface MatchState {
  draft: MatchDraft
  live: LiveState
  result: ResultState
}

type Action =
  | { type: 'setOpponent', opponent: Player | null }
  | { type: 'setCourt', court: Court | null }
  | { type: 'start' }
  | { type: 'tick' }
  | { type: 'end' }
  | { type: 'setScores', userScore: number, oppScore: number }
  | { type: 'setOutcome', delta:number, ratingBefore:number, ratingAfter:number, rankBefore:number, rankAfter:number }
  | { type: 'reset' }

const initialState: MatchState = {
  draft: { opponent: null, court: null, mode: '1v1' },
  live: { startedAt: null, seconds: 0, active: false },
  result: { userScore: null, oppScore: null, delta: null, ratingBefore: null, ratingAfter: null, rankBefore: null, rankAfter: null }
}

function reducer(state: MatchState, action: Action): MatchState {
  switch (action.type) {
    case 'setOpponent':
      return { ...state, draft: { ...state.draft, opponent: action.opponent } }
    case 'setCourt':
      return { ...state, draft: { ...state.draft, court: action.court } }
    case 'start':
      return { ...state, live: { startedAt: Date.now(), seconds: 0, active: true }, result: initialState.result }
    case 'tick':
      return state.live.active ? { ...state, live: { ...state.live, seconds: state.live.seconds + 1 } } : state
    case 'end':
      return { ...state, live: { ...state.live, active: false } }
    case 'setScores':
      return { ...state, result: { ...state.result, userScore: action.userScore, oppScore: action.oppScore } }
    case 'setOutcome':
      return { ...state, result: { ...state.result, delta: action.delta, ratingBefore: action.ratingBefore, ratingAfter: action.ratingAfter, rankBefore: action.rankBefore, rankAfter: action.rankAfter } }
    case 'reset':
      return initialState
    default:
      return state
  }
}

const MatchContext = createContext<{ state: MatchState, dispatch: React.Dispatch<Action> } | undefined>(undefined)

export const MatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo(()=>({ state, dispatch }), [state])
  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
}

export function useMatch() {
  const ctx = useContext(MatchContext)
  if (!ctx) throw new Error('useMatch must be used within MatchProvider')
  return ctx
}
