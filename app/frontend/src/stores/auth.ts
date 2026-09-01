/**
 * Auth state. The access token lives ONLY here, in memory - it is never
 * written to localStorage or sessionStorage (the whole point of the
 * in-memory + httpOnly-refresh-cookie design). A page reload therefore
 * always goes through bootstrapSession(), which recovers via the cookie.
 */

import { create } from 'zustand'
import { api, setAccessToken } from '../lib/api-client'

interface TokenOut {
  access_token: string
}

type AuthStatus = 'unknown' | 'signed-out' | 'signed-in'

interface AuthState {
  status: AuthStatus
  /** True once the PIN gate has been passed this session. */
  unlocked: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, householdName: string) => Promise<void>
  logout: () => Promise<void>
  /** Recover the session after a reload using the refresh cookie. */
  bootstrapSession: () => Promise<void>
  setUnlocked: (v: boolean) => void
}

export const useAuth = create<AuthState>((set) => ({
  status: 'unknown',
  unlocked: false,

  login: async (email, password) => {
    const out = await api<TokenOut>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(out.access_token)
    set({ status: 'signed-in', unlocked: true })
  },

  signup: async (email, password, householdName) => {
    const out = await api<TokenOut>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, household_name: householdName }),
    })
    setAccessToken(out.access_token)
    set({ status: 'signed-in', unlocked: true })
  },

  logout: async () => {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
      set({ status: 'signed-out', unlocked: false })
    }
  },

  bootstrapSession: async () => {
    try {
      const out = await api<TokenOut>('/api/v1/auth/refresh', { method: 'POST' })
      setAccessToken(out.access_token)
      // Session recovered, but the human at the screen is unverified: the
      // PIN gate stays closed (spec §7.3 - the threat is a borrowed phone).
      set({ status: 'signed-in', unlocked: false })
    } catch {
      set({ status: 'signed-out', unlocked: false })
    }
  },

  setUnlocked: (v) => set({ unlocked: v }),
}))
