import { useEffect } from 'react'
import { useAuth } from './stores/auth'
import LoginPage from './components/LoginPage'
import PinGate from './components/PinGate'
import AppShell from './components/AppShell'
import { initOfflineQueue } from './lib/offline-queue'

export default function App() {
  const status = useAuth((s) => s.status)
  const unlocked = useAuth((s) => s.unlocked)
  const bootstrapSession = useAuth((s) => s.bootstrapSession)

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
  if (status === 'signed-out') return <LoginPage />
  if (!unlocked) return <PinGate />
  return <AppShell />
}
