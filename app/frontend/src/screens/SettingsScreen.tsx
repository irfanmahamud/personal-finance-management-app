import { useTranslation } from 'react-i18next'
import { useAuth } from '../stores/auth'
import { usePatchSettings, useSettings } from '../lib/queries'

export default function SettingsScreen({ onOpenCategories }: { onOpenCategories: () => void }) {
  const { t, i18n } = useTranslation()
  const logout = useAuth((s) => s.logout)
  const { data: settings } = useSettings()
  const patch = usePatchSettings()

  async function setLocale(locale: 'en' | 'bn') {
    await i18n.changeLanguage(locale) // instant UI response
    patch.mutate({ locale }) // persisted server-side
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-4">
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
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-200 text-neutral-700'
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
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-200 text-neutral-700'
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

      <button onClick={() => void logout()} className="text-sm text-red-600 underline">
        {t('auth.signOut')}
      </button>
    </main>
  )
}
