import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../stores/auth'
import { ApiError } from '../lib/api-client'

export default function LoginPage() {
  const { t } = useTranslation()
  const login = useAuth((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.serverUnreachable'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-bold text-neutral-900">{t('auth.signIn')}</h1>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </main>
  )
}
