import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { drainQueue, onQueueChange } from '../lib/offline-queue'
import { usePatchSettings, useSettings } from '../lib/queries'
import BrandMark from './BrandMark'
import ExpenseEntryPanel from './ExpenseEntryPanel'
import NotificationBell from './NotificationBell'
import QuickAdd from './QuickAdd'
import {
  IconBudget,
  IconHome,
  IconLedger,
  IconPlus,
  IconReports,
  IconSettings,
} from './icons'
import HomeScreen from '../screens/HomeScreen'
import ExpensesScreen from '../screens/ExpensesScreen'
import BudgetScreen from '../screens/BudgetScreen'
import ReportsScreen from '../screens/ReportsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import CategoriesScreen from '../screens/CategoriesScreen'
import IncomeScreen from '../screens/IncomeScreen'
import RecurringScreen from '../screens/RecurringScreen'
import FamilyScreen from '../screens/FamilyScreen'
import SavingsScreen from '../screens/SavingsScreen'
import InvestmentsScreen from '../screens/InvestmentsScreen'
import DebtsScreen from '../screens/DebtsScreen'
import LoansScreen from '../screens/LoansScreen'
import NetWorthScreen from '../screens/NetWorthScreen'
import TipsScreen from '../screens/TipsScreen'
import ZakatScreen from '../screens/ZakatScreen'

export type Tab =
  | 'home'
  | 'expenses'
  | 'budget'
  | 'reports'
  | 'settings'
  | 'categories'
  | 'income'
  | 'recurring'
  | 'family'
  | 'savings'
  | 'investments'
  | 'debts'
  | 'loans'
  | 'networth'
  | 'tips'
  | 'zakat'

/**
 * Redesign shell (mock: "User panel layout").
 *  - Mobile (<lg): top header (emblem + name, language pill) + bottom tabs
 *    + FAB opening the quick-add sheet.
 *  - Desktop (lg+): header + fixed sidebar (nav, pending-sync, language
 *    toggle) + main + persistent "Log an expense" rail on Home/Expenses.
 */
export default function AppShell() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>('home')
  const [quickAdd, setQuickAdd] = useState(false)
  const [pending, setPending] = useState(0)
  const { data: settings } = useSettings()
  const patchSettings = usePatchSettings()

  useEffect(() => onQueueChange(setPending), [])

  // Server-persisted locale wins over the client default.
  useEffect(() => {
    if (settings && settings.locale !== i18n.language) {
      void i18n.changeLanguage(settings.locale)
    }
  }, [settings, i18n])


  async function setLocale(locale: 'en' | 'bn') {
    await i18n.changeLanguage(locale)
    patchSettings.mutate({ locale })
  }

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'home', label: t('nav.home'), icon: <IconHome /> },
    { key: 'expenses', label: t('nav.expenses'), icon: <IconLedger /> },
    { key: 'budget', label: t('nav.budget'), icon: <IconBudget /> },
    { key: 'reports', label: t('nav.reports'), icon: <IconReports /> },
    { key: 'settings', label: t('nav.settings'), icon: <IconSettings /> },
  ]
  const activeTop =
    tab === 'categories' ||
    tab === 'income' ||
    tab === 'recurring' ||
    tab === 'family' ||
    tab === 'savings' ||
    tab === 'investments' ||
    tab === 'debts' ||
    tab === 'loans' ||
    tab === 'networth' ||
    tab === 'tips' ||
    tab === 'zakat'
      ? 'settings'
      : tab
  const showRail = tab === 'home' || tab === 'expenses'

  const screen = (
    <>
      {tab === 'home' && <HomeScreen />}
      {tab === 'expenses' && <ExpensesScreen />}
      {tab === 'budget' && <BudgetScreen />}
      {tab === 'reports' && <ReportsScreen />}
      {tab === 'settings' && (
        <SettingsScreen
          onOpenCategories={() => setTab('categories')}
          onOpenIncome={() => setTab('income')}
          onOpenRecurring={() => setTab('recurring')}
          onOpenFamily={() => setTab('family')}
          onOpenSavings={() => setTab('savings')}
          onOpenInvestments={() => setTab('investments')}
          onOpenDebts={() => setTab('debts')}
          onOpenLoans={() => setTab('loans')}
          onOpenNetWorth={() => setTab('networth')}
          onOpenTips={() => setTab('tips')}
          onOpenZakat={() => setTab('zakat')}
        />
      )}
      {tab === 'categories' && <CategoriesScreen onBack={() => setTab('settings')} />}
      {tab === 'income' && <IncomeScreen onBack={() => setTab('settings')} />}
      {tab === 'recurring' && <RecurringScreen onBack={() => setTab('settings')} />}
      {tab === 'family' && <FamilyScreen onBack={() => setTab('settings')} />}
      {tab === 'savings' && <SavingsScreen onBack={() => setTab('settings')} />}
      {tab === 'investments' && <InvestmentsScreen onBack={() => setTab('settings')} />}
      {tab === 'debts' && <DebtsScreen onBack={() => setTab('settings')} />}
      {tab === 'loans' && <LoansScreen onBack={() => setTab('settings')} />}
      {tab === 'networth' && <NetWorthScreen onBack={() => setTab('settings')} />}
      {tab === 'tips' && <TipsScreen onBack={() => setTab('settings')} />}
      {tab === 'zakat' && <ZakatScreen onBack={() => setTab('settings')} />}
    </>
  )

  const pendingBanner = pending > 0 && (
    <button
      onClick={() => void drainQueue()}
      className="flex w-full items-center justify-center gap-2 bg-amber-500 py-1.5 text-center text-xs font-medium text-white lg:w-auto lg:justify-start lg:rounded-lg lg:bg-amber-50 lg:px-2.5 lg:py-2 lg:text-amber-800"
    >
      <span className="hidden h-1.5 w-1.5 rounded-full bg-current lg:inline-block" />⏳ {pending}{' '}
      {t('offline.pending')}
    </button>
  )

  const languageToggle = (
    <div className="flex gap-1 rounded-lg bg-neutral-200 p-0.5">
      {(['en', 'bn'] as const).map((loc) => (
        <button
          key={loc}
          onClick={() => void setLocale(loc)}
          className={`flex-1 rounded-md px-2.5 py-1.5 text-center text-xs font-semibold ${
            (settings?.locale ?? i18n.language) === loc
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-400'
          }`}
        >
          {loc === 'en' ? 'EN' : 'বাংলা'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ---------- Mobile (<lg) ---------- */}
      <div className="lg:hidden">
        {pending > 0 && <div className="fixed inset-x-0 top-0 z-40">{pendingBanner}</div>}

        <header className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-3.5">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-sm font-bold text-neutral-900">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            {languageToggle}
          </div>
        </header>

        <div className="pb-20">{screen}</div>

        <button
          onClick={() => setQuickAdd(true)}
          aria-label="+"
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:bg-brand-700"
        >
          <IconPlus size={26} />
        </button>
        {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} />}

        <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-lg justify-around">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex min-w-14 flex-col items-center gap-1 px-3 py-2 text-[10px] ${
                  activeTop === item.key
                    ? 'font-semibold text-brand-700'
                    : 'text-neutral-500'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* ---------- Desktop (lg+) ---------- */}
      <div className="hidden min-h-screen flex-col lg:flex">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="text-base font-bold text-neutral-900">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            {languageToggle}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {(settings?.household_name?.[0] ?? '·').toUpperCase()}
            </span>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex flex-col gap-7 border-r border-neutral-200 bg-neutral-100 px-4 py-6">
            <div className="flex flex-col gap-0.5">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                    activeTop === item.key
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'text-neutral-500 hover:bg-neutral-200/60'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3">
              {pendingBanner}
              {languageToggle}
            </div>
          </nav>

          <div
            className={`grid min-w-0 ${showRail ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'}`}
          >
            <main className="min-w-0 px-8 py-7 pb-14">{screen}</main>
            {showRail && (
              <aside className="border-l border-neutral-200 bg-white px-6 py-7">
                <div className="sticky top-6">
                  <ExpenseEntryPanel instantSave={false} />
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
