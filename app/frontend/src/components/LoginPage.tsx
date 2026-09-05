import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BrandMark from './BrandMark'
import { IconEye, IconEyeOff } from './icons'
import { useAuth } from '../stores/auth'
import { ApiError } from '../lib/api-client'

export type AuthMode = 'signin' | 'signup'

export default function LoginPage({
  initialMode = 'signin',
  onLogoClick,
}: { initialMode?: AuthMode; onLogoClick?: () => void } = {}) {
  const { t } = useTranslation()
  const login = useAuth((s) => s.login)
  const signup = useAuth((s) => s.signup)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') {
        await signup(email, password, householdName || 'Household')
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.serverUnreachable'))
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-3 pb-2">
          {onLogoClick ? (
            <button type="button" onClick={onLogoClick} aria-label={t('auth.backToLanding')}>
              <BrandMark size={56} />
            </button>
          ) : (
            <BrandMark size={56} />
          )}
          <h1 className="text-2xl font-bold text-neutral-900">{t('app.name')}</h1>
        </div>

        <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'signin' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
            }`}
          >
            {t('auth.signIn')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'signup' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
            }`}
          >
            {t('auth.signUp')}
          </button>
        </div>

        {mode === 'signup' && (
          <input
            type="text"
            autoComplete="organization"
            placeholder={t('auth.householdName')}
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base"
          />
        )}
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base"
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 pr-11 text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400"
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
        {mode === 'signup' && (
          <p className="text-xs text-neutral-400">{t('auth.passwordHint')}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? mode === 'signup'
              ? t('auth.signingUp')
              : t('auth.signingIn')
            : mode === 'signup'
              ? t('auth.signUp')
              : t('auth.signIn')}
        </button>
      </form>
    </main>
  )
}
