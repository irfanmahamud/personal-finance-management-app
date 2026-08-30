import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../stores/auth'
import { api, ApiError } from '../lib/api-client'

/**
 * The lock that actually matters (spec §7.3): re-verify the human after a
 * cold start or inactivity. Verification is server-side - the client never
 * sees a PIN hash, and the server rate-limits attempts.
 *
 * A user with no PIN yet is prompted to set one (requires their password).
 */
export default function PinGate() {
  const { t } = useTranslation()
  const setUnlocked = useAuth((s) => s.setUnlocked)
  const logout = useAuth((s) => s.logout)
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'verify' | 'setup'>('verify')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function verify(candidate: string) {
    try {
      const out = await api<{ ok: boolean }>('/api/v1/auth/pin/verify', {
        method: 'POST',
        body: JSON.stringify({ pin: candidate }),
      })
      if (out.ok) setUnlocked(true)
      else {
        setError(t('auth.wrongPin'))
        setPin('')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setMode('setup')
      else if (err instanceof ApiError) setError(err.detail)
      else setError(t('auth.serverUnreachable'))
      setPin('')
    }
  }

  async function setup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api('/api/v1/auth/pin', {
        method: 'PUT',
        body: JSON.stringify({ password, pin }),
      })
      setUnlocked(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.serverUnreachable'))
    }
  }

  useEffect(() => {
    if (mode === 'verify' && pin.length === 6) void verify(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, mode])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6">
      {mode === 'verify' ? (
        <div className="w-full max-w-xs space-y-4 text-center">
          <h1 className="text-xl font-bold text-neutral-900">{t('auth.enterPin')}</h1>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={() => void logout()} className="text-sm text-neutral-500 underline">
            {t('auth.signOut')}
          </button>
        </div>
      ) : (
        <form onSubmit={setup} className="w-full max-w-xs space-y-4">
          <h1 className="text-center text-xl font-bold text-neutral-900">{t('auth.setPin')}</h1>
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder={t('auth.accountPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder={t('auth.newPin')}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white"
          >
            {t('auth.savePin')}
          </button>
        </form>
      )}
    </main>
  )
}
