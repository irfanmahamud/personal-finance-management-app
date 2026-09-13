import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../lib/api-client'
import { useAuth } from '../stores/auth'
import { usePatchSettings, useSettings } from '../lib/queries'

export default function SettingsScreen({
  onOpenCategories,
  onOpenIncome,
  onOpenRecurring,
  onOpenFamily,
  onOpenSavings,
  onOpenInvestments,
  onOpenDebts,
  onOpenLoans,
  onOpenNetWorth,
  onOpenTips,
  onOpenZakat,
}: {
  onOpenCategories: () => void
  onOpenIncome: () => void
  onOpenRecurring: () => void
  onOpenFamily: () => void
  onOpenSavings: () => void
  onOpenInvestments: () => void
  onOpenDebts: () => void
  onOpenLoans: () => void
  onOpenNetWorth: () => void
  onOpenTips: () => void
  onOpenZakat: () => void
}) {
  const { t, i18n } = useTranslation()
  const logout = useAuth((s) => s.logout)
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function setLocale(locale: 'en' | 'bn') {
    await i18n.changeLanguage(locale) // instant UI response
    patch.mutate({ locale }) // persisted server-side
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <h1 className="text-xl font-bold text-neutral-900">{t('settings.title')}</h1>

      <section>
        <h2 className="text-sm font-medium text-neutral-700">{t('settings.language')}</h2>
        <div className="mt-2 flex gap-2">
          {(['en', 'bn'] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => void setLocale(loc)}
              className={`rounded-full px-4 py-2 text-sm ${
                (settings?.locale ?? i18n.language) === loc
                  ? 'border border-brand-600 bg-brand-600 text-white'
                  : 'border border-neutral-200 bg-white text-neutral-500'
              }`}
            >
              {loc === 'en' ? t('settings.english') : t('settings.bangla')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-700">{t('settings.fiscalYear')}</h2>
        <div className="mt-2 flex gap-2">
          {[7, 1].map((month) => (
            <button
              key={month}
              onClick={() => patch.mutate({ fiscal_year_start: month })}
              className={`rounded-full px-4 py-2 text-sm ${
                settings?.fiscal_year_start === month
                  ? 'border border-brand-600 bg-brand-600 text-white'
                  : 'border border-neutral-200 bg-white text-neutral-500'
              }`}
            >
              {month === 7 ? t('settings.july') : t('settings.january')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-700">{t('settings.eidMode')}</h2>
        <p className="mt-1 text-xs text-neutral-400">{t('settings.eidModeHint')}</p>
        <button
          onClick={() => patch.mutate({ eid_mode_enabled: !settings?.eid_mode_enabled })}
          className={`mt-2 rounded-full px-4 py-2 text-sm ${
            settings?.eid_mode_enabled
              ? 'border border-brand-600 bg-brand-600 text-white'
              : 'border border-neutral-200 bg-white text-neutral-500'
          }`}
        >
          {settings?.eid_mode_enabled ? t('settings.eidModeOn') : t('settings.eidModeOff')}
        </button>
      </section>

      <button
        onClick={onOpenCategories}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('categories.title')} →
      </button>

      <button
        onClick={onOpenIncome}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('income.title')} →
      </button>

      <button
        onClick={onOpenRecurring}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('recurring.title')} →
      </button>

      <button
        onClick={onOpenFamily}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('family.title')} →
      </button>

      <button
        onClick={onOpenSavings}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('savings.title')} →
      </button>

      <button
        onClick={onOpenInvestments}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('investments.title')} →
      </button>

      <button
        onClick={onOpenDebts}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('debts.title')} →
      </button>

      <button
        onClick={onOpenLoans}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('loans.title')} →
      </button>

      <button
        onClick={onOpenNetWorth}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('networth.title')} →
      </button>

      <button
        onClick={onOpenTips}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('tips.title')} →
      </button>

      <button
        onClick={onOpenZakat}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium"
      >
        {t('zakat.title')} →
      </button>

      {/* lg+ has sign-out in the sidebar bottom (AppShell.tsx) instead -
       * this is the mobile-only copy, since mobile has no sidebar. */}
      <button onClick={() => void logout()} className="text-sm text-red-600 underline lg:hidden">
        {t('auth.signOut')}
      </button>

      <button
        onClick={() => setConfirmingDelete(true)}
        className="text-sm text-red-600 underline"
      >
        {t('settings.deleteAccount')}
      </button>

      {confirmingDelete && (
        <DeleteAccountDialog onClose={() => setConfirmingDelete(false)} />
      )}
    </main>
  )
}

/** Irreversible - explains what actually gets deleted (this app has no
 * invite flow, so "your account" IS the whole household) before requiring
 * the password back, same re-confirm-identity pattern as auth.py::set_pin.
 * Same bottom-sheet-on-mobile/centered-on-desktop shape as
 * CategorySpendSheet - the app's one sanctioned modal surface. */
function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const deleteAccount = useAuth((s) => s.deleteAccount)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onConfirm() {
    setError(null)
    setPending(true)
    try {
      await deleteAccount(password)
      // On success the auth store flips to signed-out and App.tsx swaps
      // this whole screen out - nothing left to close here.
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('settings.deleteAccountFailed'))
      setPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/40 lg:items-center lg:justify-center lg:p-4"
      onClick={onClose}
    >
      <div
        className="mt-auto max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 lg:mt-0 lg:w-full lg:max-w-md lg:rounded-2xl lg:pb-4 lg:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-neutral-900">{t('settings.deleteAccountTitle')}</h2>
        <p className="mt-2 text-sm text-neutral-600">{t('settings.deleteAccountExplain')}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-600">
          <li>{t('settings.deleteAccountPoint1')}</li>
          <li>{t('settings.deleteAccountPoint2')}</li>
          <li>{t('settings.deleteAccountPoint3')}</li>
        </ul>

        <label className="mt-4 block text-xs font-medium text-neutral-500">
          {t('settings.deleteAccountConfirmPassword')}
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700"
          >
            {t('categories.cancel')}
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={!password || pending}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? t('common.loading') : t('settings.deleteAccountConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
