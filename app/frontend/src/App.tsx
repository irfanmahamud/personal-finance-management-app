import { useEffect, useState } from 'react'
import { api, ApiError } from './lib/api-client'

interface Health {
  status: string
}

/**
 * M0 shell: proves the SPA reaches the backend through the Vite proxy.
 * Replaced by the real router + app shell in M2.
 */
export default function App() {
  const [health, setHealth] = useState<string>('checking…')
  const [settingsStatus, setSettingsStatus] = useState<string>('checking…')

  useEffect(() => {
    api<Health>('/health')
      .then((h) => setHealth(h.status))
      .catch(() => setHealth('unreachable'))
    api('/api/v1/settings')
      .then(() => setSettingsStatus('authenticated (unexpected in M0)'))
      .catch((e: unknown) =>
        setSettingsStatus(
          e instanceof ApiError && e.status === 401
            ? '401 as expected - auth arrives in M1'
            : 'unreachable',
        ),
      )
  }, [])

  return (
    <main className="min-h-screen bg-neutral-50 p-8 font-sans text-neutral-900">
      <h1 className="text-2xl font-bold">Personal Finance — M0</h1>
      <dl className="mt-6 space-y-2 text-sm">
        <div>
          <dt className="font-medium">Backend /health</dt>
          <dd className="text-neutral-600">{health}</dd>
        </div>
        <div>
          <dt className="font-medium">GET /api/v1/settings</dt>
          <dd className="text-neutral-600">{settingsStatus}</dd>
        </div>
      </dl>
    </main>
  )
}
