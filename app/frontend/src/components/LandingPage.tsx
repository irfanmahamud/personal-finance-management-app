import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuthMode } from './LoginPage'

const BrandEmblem3D = lazy(() => import('./BrandEmblem3D'))

const FEATURES = [
  { emoji: '💸', titleKey: 'landing.feature.expenses.title', descKey: 'landing.feature.expenses.desc' },
  { emoji: '📊', titleKey: 'landing.feature.budgeting.title', descKey: 'landing.feature.budgeting.desc' },
  { emoji: '🧾', titleKey: 'landing.feature.tax.title', descKey: 'landing.feature.tax.desc' },
  { emoji: '🌙', titleKey: 'landing.feature.zakat.title', descKey: 'landing.feature.zakat.desc' },
  { emoji: '🎯', titleKey: 'landing.feature.goals.title', descKey: 'landing.feature.goals.desc' },
  { emoji: '📴', titleKey: 'landing.feature.offline.title', descKey: 'landing.feature.offline.desc' },
  { emoji: '🌐', titleKey: 'landing.feature.bilingual.title', descKey: 'landing.feature.bilingual.desc' },
  { emoji: '👨‍👩‍👧', titleKey: 'landing.feature.family.title', descKey: 'landing.feature.family.desc' },
] as const

/** Pre-login landing page (not spec-numbered - see CLAUDE.md). Shown once
 * per browser ahead of LoginPage (App.tsx owns the gate/flag); this
 * component is stateless, just two CTAs that report which LoginPage tab
 * to open. */
export default function LandingPage({ onContinue }: { onContinue: (mode: AuthMode) => void }) {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-lg space-y-10 p-4 py-10">
        {/* Hero */}
        <section className="text-center">
          <Suspense fallback={<div className="h-[220px] w-full rounded-xl bg-[#241d16]" />}>
            <BrandEmblem3D />
          </Suspense>
          <p className="mt-3 text-xl font-bold text-neutral-900">{t('app.name')}</p>
          <h1 className="mt-4 text-4xl font-bold text-neutral-900">{t('landing.headline')}</h1>
          <p className="mt-3 text-sm text-neutral-500">{t('landing.subhead')}</p>
          <button
            onClick={() => onContinue('signup')}
            className="mt-6 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white"
          >
            {t('landing.getStarted')}
          </button>
          <p className="mt-3 text-sm text-neutral-500">
            {t('landing.alreadyHaveAccount')}{' '}
            <button
              type="button"
              onClick={() => onContinue('signin')}
              className="font-medium text-brand-600 underline"
            >
              {t('auth.signIn')}
            </button>
          </p>
        </section>

        {/* Feature grid */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t('landing.featuresLabel')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.titleKey} className="rounded-xl border border-neutral-200 bg-white p-3">
                <span className="text-xl" aria-hidden="true">{f.emoji}</span>
                <p className="mt-1 text-sm font-medium text-neutral-900">{t(f.titleKey)}</p>
                <p className="text-xs text-neutral-500">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Built for Bangladesh */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t('landing.bangladeshLabel')}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{t('landing.bangladeshBody')}</p>
        </section>

        {/* Your data */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t('landing.privacyLabel')}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{t('landing.privacyBody')}</p>
        </section>

        {/* Footer CTA */}
        <section className="text-center">
          <h2 className="text-xl font-bold text-neutral-900">{t('landing.footerHeadline')}</h2>
          <button
            onClick={() => onContinue('signup')}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white"
          >
            {t('landing.getStarted')}
          </button>
          <p className="mt-3 text-sm text-neutral-500">
            {t('landing.alreadyHaveAccount')}{' '}
            <button
              type="button"
              onClick={() => onContinue('signin')}
              className="font-medium text-brand-600 underline"
            >
              {t('auth.signIn')}
            </button>
          </p>
        </section>
      </div>
    </main>
  )
}
