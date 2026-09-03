import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BrandMark from './BrandMark'
import type { AuthMode } from './LoginPage'

const BrandEmblem3D = lazy(() => import('./BrandEmblem3D'))

function setLocale(i18n: { changeLanguage: (l: string) => void }, lang: 'en' | 'bn') {
  i18n.changeLanguage(lang)
  try {
    localStorage.setItem('lang', lang)
  } catch {
    // Non-critical: worst case the choice doesn't survive a reload.
  }
}

const PROOF = [
  { key: 'offline' },
  { key: 'bilingual' },
  { key: 'grouping' },
  { key: 'account' },
] as const

const STEP_NUMS = { en: ['01', '02', '03'], bn: ['০১', '০২', '০৩'] } as const
const STEPS = ['step1', 'step2', 'step3'] as const

const FEATURES = [
  { key: 'expenses', icon: IconExpenses },
  { key: 'budgets', icon: IconBudgets },
  { key: 'tax', icon: IconTax },
  { key: 'zakat', icon: IconZakat },
  { key: 'goals', icon: IconGoals },
  { key: 'family', icon: IconFamily },
] as const

const FOOTER_COLS = [
  { titleKey: 'landing.footerProductTitle', items: ['footerProduct1', 'footerProduct2', 'footerProduct3', 'footerProduct4'] },
  { titleKey: 'landing.footerMoneyTitle', items: ['footerMoney1', 'footerMoney2', 'footerMoney3', 'footerMoney4'] },
  { titleKey: 'landing.footerAboutTitle', items: ['footerAbout1', 'footerAbout2', 'footerAbout3'] },
] as const

/** Pre-login landing page (not spec-numbered - see CLAUDE.md). Shown once
 * per browser ahead of LoginPage (App.tsx owns the gate/flag); stateless
 * except its own mobile-nav toggle and the language switch (which flips
 * the shared i18n instance directly - LoginPage inherits whatever
 * language was picked here). */
export default function LandingPage({ onContinue }: { onContinue: (mode: AuthMode) => void }) {
  const { t, i18n } = useTranslation()
  const bn = i18n.language === 'bn'
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const primaryBtn =
    'min-h-11 rounded-lg bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700'
  const langBtn = (active: boolean) =>
    `min-h-8 rounded-md px-2.5 text-xs font-semibold ${
      active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400'
    }`

  return (
    <main className="bg-white text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-3 px-5 md:h-[68px] md:gap-8">
          <div className="flex items-center gap-2">
            <BrandMark size={30} />
            <span className="text-[1.0625rem] font-bold tracking-tight">{t('app.name')}</span>
          </div>
          <nav className="hidden gap-8 md:flex">
            <a href="#how" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              {t('landing.navHow')}
            </a>
            <a href="#inside" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              {t('landing.navInside')}
            </a>
            <a href="#trust" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              {t('landing.navTrust')}
            </a>
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <div className="flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
              <button onClick={() => setLocale(i18n, 'en')} className={langBtn(!bn)}>
                EN
              </button>
              <button onClick={() => setLocale(i18n, 'bn')} className={langBtn(bn)}>
                বাংলা
              </button>
            </div>
            <button
              onClick={() => onContinue('signin')}
              className="text-sm font-semibold text-neutral-900"
            >
              {t('auth.signIn')}
            </button>
            <button onClick={() => onContinue('signup')} className={primaryBtn}>
              {t('landing.cta')}
            </button>
          </div>
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-11 w-11 items-center justify-center text-neutral-900 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>

        {mobileNavOpen && (
          <div className="flex flex-col gap-1 border-t border-neutral-100 bg-white px-5 py-4 md:hidden">
            <a
              href="#how"
              onClick={() => setMobileNavOpen(false)}
              className="flex min-h-11 items-center text-base font-medium text-neutral-900"
            >
              {t('landing.navHow')}
            </a>
            <a
              href="#inside"
              onClick={() => setMobileNavOpen(false)}
              className="flex min-h-11 items-center border-t border-neutral-100 text-base font-medium text-neutral-900"
            >
              {t('landing.navInside')}
            </a>
            <a
              href="#trust"
              onClick={() => setMobileNavOpen(false)}
              className="flex min-h-11 items-center border-t border-neutral-100 text-base font-medium text-neutral-900"
            >
              {t('landing.navTrust')}
            </a>
            <div className="mt-1 flex items-center justify-between border-t border-neutral-100 pt-3.5">
              <div className="flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
                <button onClick={() => setLocale(i18n, 'en')} className={langBtn(!bn)}>
                  EN
                </button>
                <button onClick={() => setLocale(i18n, 'bn')} className={langBtn(bn)}>
                  বাংলা
                </button>
              </div>
              <button
                onClick={() => onContinue('signin')}
                className="min-h-11 text-sm font-semibold text-neutral-900"
              >
                {t('auth.signIn')}
              </button>
            </div>
            <button
              onClick={() => onContinue('signup')}
              className="mt-2 min-h-12 w-full rounded-xl bg-brand-600 font-semibold text-white"
            >
              {t('landing.cta')}
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="px-5 pt-10 text-center md:pt-[72px]">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-6 max-w-[220px] shadow-xl md:mb-8 md:max-w-[264px]">
            <Suspense fallback={<div className="h-[220px] w-full rounded-xl bg-[#241d16]" />}>
              <BrandEmblem3D height={220} />
            </Suspense>
          </div>
          <p className="mb-7 text-[11px] font-medium uppercase tracking-widest text-neutral-400">
            {t('landing.dragHint')}
          </p>
          <h1 className="mx-auto max-w-[24ch] text-3xl font-extrabold tracking-tight text-balance md:max-w-[22ch] md:text-5xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mx-auto mt-5 max-w-[62ch] text-base leading-relaxed text-neutral-600 md:mt-8 md:text-lg">
            {t('landing.heroSub')}
          </p>
          <button onClick={() => onContinue('signup')} className={`${primaryBtn} mt-6 px-8 md:mt-8`}>
            {t('landing.cta')}
          </button>
          <p className="mt-4 text-sm text-neutral-400">{t('landing.heroNote')}</p>

          <div className="mt-12 grid grid-cols-2 border-t border-neutral-200 md:mt-[72px] md:grid-cols-4">
            {PROOF.map((p, i) => (
              <div
                key={p.key}
                className={`border-b border-neutral-200 px-3.5 py-5 text-center md:border-b-0 md:px-5 md:py-7 ${
                  i % 2 === 0 ? 'border-r border-neutral-200' : ''
                } ${i === 1 ? 'md:border-r md:border-neutral-200' : ''}`}
              >
                <span className="mb-1 block text-xl font-bold tracking-tight">
                  {t(`landing.proof.${p.key}.label`)}
                </span>
                <span className="text-sm text-neutral-400">{t(`landing.proof.${p.key}.value`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-5 py-14 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-9 max-w-2xl text-center md:mb-14">
            <Eyebrow>{t('landing.howEyebrow')}</Eyebrow>
            <h2 className="mb-3.5 text-2xl font-extrabold tracking-tight text-balance md:text-4xl">
              {t('landing.howTitle')}
            </h2>
            <p className="text-lg text-neutral-600">{t('landing.howSub')}</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
            {STEPS.map((step, i) => (
              <div key={step}>
                <p className="mb-4 text-sm font-bold tracking-widest text-brand-600">
                  {bn ? STEP_NUMS.bn[i] : STEP_NUMS.en[i]}
                </p>
                <h3 className="mb-2.5 text-2xl font-bold tracking-tight">
                  {t(`landing.${step}Title`)}
                </h3>
                <p className="text-neutral-600">{t(`landing.${step}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's inside */}
      <section id="inside" className="border-y border-neutral-200 bg-neutral-50 px-5 py-14 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-9 max-w-2xl text-center md:mb-14">
            <Eyebrow>{t('landing.insideEyebrow')}</Eyebrow>
            <h2 className="mb-3.5 text-2xl font-extrabold tracking-tight text-balance md:text-4xl">
              {t('landing.insideTitle')}
            </h2>
            <p className="text-lg text-neutral-600">{t('landing.insideSub')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-2xl border border-neutral-200 bg-white p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-700">
                  <Icon />
                </span>
                <h3 className="mb-1.5 mt-5 text-lg font-bold tracking-tight">
                  {t(`landing.feature.${key}.title`)}
                </h3>
                <p className="text-neutral-600">{t(`landing.feature.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="px-5 py-14 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-neutral-400">
              {t('landing.trustBangladeshLabel')}
            </p>
            <p className="text-lg leading-relaxed text-neutral-600">{t('landing.trustBangladeshBody')}</p>
          </div>
          <div className="rounded-2xl border border-brand-500 bg-white p-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">
              {t('landing.trustPrivacyLabel')}
            </p>
            <p className="text-lg leading-relaxed text-neutral-600">{t('landing.trustPrivacyBody')}</p>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-[#241d16] px-5 py-16 text-center md:py-[104px]">
        <div className="mx-auto max-w-6xl">
          <h2 className="mx-auto mb-7 max-w-[18ch] text-3xl font-extrabold tracking-tight text-balance text-brand-50 md:mb-8 md:text-5xl">
            {t('landing.ctaTitle')}
          </h2>
          <button onClick={() => onContinue('signup')} className={`${primaryBtn} px-8`}>
            {t('landing.ctaNow')}
          </button>
          <p className="mt-5 text-brand-100/60">
            {t('landing.ctaEcho')}{' '}
            <button onClick={() => onContinue('signin')} className="font-semibold text-brand-400">
              {t('landing.ctaSignIn')}
            </button>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-10 md:py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-7 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <BrandMark size={30} />
              <span className="text-[1.0625rem] font-bold tracking-tight">{t('app.name')}</span>
            </div>
            <p className="mt-3.5 max-w-[34ch] text-sm leading-relaxed text-neutral-600">
              {t('landing.footBlurb')}
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.titleKey}>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
                {t(col.titleKey)}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <li key={item} className="text-sm text-neutral-600">
                    {t(`landing.${item}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </main>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3.5 text-sm font-semibold uppercase tracking-widest text-brand-600">
      {children}
    </p>
  )
}

function IconExpenses() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </svg>
  )
}

function IconBudgets() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5h17" />
      <rect x="5" y="12" width="3.6" height="6" />
      <rect x="10.2" y="7.5" width="3.6" height="10.5" />
      <rect x="15.4" y="4" width="3.6" height="14" />
    </svg>
  )
}

function IconTax() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5h12v19l-3-1.8-3 1.8-3-1.8-3 1.8v-19Z" />
      <path d="M9.5 7.5h5M9.5 11.5h5M9.5 15.5h2.5" />
    </svg>
  )
}

function IconZakat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 3.2a8.8 8.8 0 1 0 4.3 12.9A9.6 9.6 0 0 1 16.5 3.2Z" />
    </svg>
  )
}

function IconGoals() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  )
}

function IconFamily() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3.1" />
      <circle cx="16.6" cy="9.4" r="2.4" />
      <path d="M2.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <path d="M15.4 14.8c3 0 5.1 2 5.1 4.7" />
    </svg>
  )
}
