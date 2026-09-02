import { useEffect, useState } from 'react'
import { useAuth } from './stores/auth'
import LoginPage, { type AuthMode } from './components/LoginPage'
import LandingPage from './components/LandingPage'
import PinGate from './components/PinGate'
import AppShell from './components/AppShell'
import { initOfflineQueue } from './lib/offline-queue'

const LANDING_SEEN_KEY = 'landing_seen'

function hasSeenLanding(): boolean {
  try {
    return localStorage.getItem(LANDING_SEEN_KEY) === '1'
  } catch {
    // Storage blocked (private mode / strict cookie policy): fail toward
    // showing the landing page once more rather than crashing. It always
    // has a working Continue path, so this never blocks sign-in.
    return false
  }
}

function markLandingSeen() {
  try {
    localStorage.setItem(LANDING_SEEN_KEY, '1')
  } catch {
    // Non-critical: worst case the landing page reappears next visit.
  }
}

export default function App() {
  const status = useAuth((s) => s.status)
  const unlocked = useAuth((s) => s.unlocked)
  const bootstrapSession = useAuth((s) => s.bootstrapSession)
  const [showLanding, setShowLanding] = useState(() => !hasSeenLanding())
  const [initialAuthMode, setInitialAuthMode] = useState<AuthMode>('signin')

  // Cold start: recover the session from the refresh cookie. The access
  // token never survives a reload by design.
  useEffect(() => {
    if (status === 'unknown') void bootstrapSession()
  }, [status, bootstrapSession])

  useEffect(() => {
    initOfflineQueue()
  }, [])

  if (status === 'unknown') {
    return <main className="flex min-h-screen items-center justify-center bg-neutral-50" />
  }
  if (status === 'signed-out') {
    if (showLanding) {
      return (
        <LandingPage
          onContinue={(mode) => {
            markLandingSeen()
            setInitialAuthMode(mode)
            setShowLanding(false)
          }}
        />
      )
    }
    return <LoginPage initialMode={initialAuthMode} />
  }
  if (!unlocked) return <PinGate />
  return <AppShell />
}
