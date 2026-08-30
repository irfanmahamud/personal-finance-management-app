import { useEffect } from 'react'
import { useAuth } from './stores/auth'
import LoginPage from './components/LoginPage'
import PinGate from './components/PinGate'
import { api } from './lib/api-client'
import { useState } from 'react'

interface Settings {
  household_name: string
  fiscal_year_start: number
  base_currency: string
  locale: string
}

/** M1 shell: gated by login + PIN. Replaced by the real router in M2. */
function Shell() {
  const logout = useAuth((s) => s.logout)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    api<Settings>('/api/v1/settings').then(setSettings).catch(() => {})
  }, [])

  return (
    <main className="min-h-screen bg-neutral-50 p-8 text-neutral-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {settings?.household_name ?? '…'}
        </h1>
        <button onClick={() => void logout()} className="text-sm text-neutral-500 underline">
          Sign out
        </button>
      </div>
      <p className="mt-4 text-sm text-neutral-600">
        Signed in and unlocked. App shell arrives in M2.
      </p>
    </main>
  )
}

export default function App() {
  const status = useAuth((s) => s.status)
  const unlocked = useAuth((s) => s.unlocked)
  const bootstrapSession = useAuth((s) => s.bootstrapSession)

  // Cold start: recover the session from the refresh cookie. The access
  // token never survives a reload by design.
  useEffect(() => {
    if (status === 'unknown') void bootstrapSession()
  }, [status, bootstrapSession])

  if (status === 'unknown') {
    return <main className="flex min-h-screen items-center justify-center bg-neutral-50" />
  }
  if (status === 'signed-out') return <LoginPage />
  if (!unlocked) return <PinGate />
  return <Shell />
}
