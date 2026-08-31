import { useTranslation } from 'react-i18next'
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
  onOpenNetWorth,
  onOpenTips,
}: {
  onOpenCategories: () => void
  onOpenIncome: () => void
  onOpenRecurring: () => void
  onOpenFamily: () => void
  onOpenSavings: () => void
  onOpenInvestments: () => void
  onOpenDebts: () => void
  onOpenNetWorth: () => void
  onOpenTips: () => void
}) {
  const { t, i18n } = useTranslation()
  const logout = useAuth((s) => s.logout)
  const { data: settings } = useSettings()
  const patch = usePatchSettings()

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
                  ? 'border border-emerald-600 bg-emerald-600 text-white'
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
                  ? 'border border-emerald-600 bg-emerald-600 text-white'
                  : 'border border-neutral-200 bg-white text-neutral-500'
              }`}
            >
              {month === 7 ? t('settings.july') : t('settings.january')}
            </button>
          ))}
        </div>
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

      <button onClick={() => void logout()} className="text-sm text-red-600 underline">
        {t('auth.signOut')}
      </button>
    </main>
  )
}
