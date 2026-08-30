import { useEffect, useState } from 'react'
import { drainQueue, onQueueChange } from '../lib/offline-queue'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../lib/queries'
import HomeScreen from '../screens/HomeScreen'
import ExpensesScreen from '../screens/ExpensesScreen'
import BudgetScreen from '../screens/BudgetScreen'
import ReportsScreen from '../screens/ReportsScreen'
import IncomeScreen from '../screens/IncomeScreen'
import QuickAdd from '../components/QuickAdd'
import CategoriesScreen from '../screens/CategoriesScreen'
import SettingsScreen from '../screens/SettingsScreen'

export type Tab = 'home' | 'expenses' | 'budget' | 'reports' | 'settings' | 'categories' | 'income'

/**
 * Mobile-first shell: bottom nav within one-thumb reach, floating add
 * button (spec §6.1). Tab state is local for M2; TanStack Router takes
 * over when the screen count justifies it.
 */
export default function AppShell() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>('home')
  const [quickAdd, setQuickAdd] = useState(false)
  const [pending, setPending] = useState(0)

  useEffect(() => onQueueChange(setPending), [])
  const { data: settings } = useSettings()

  // Server-persisted locale wins over the client default.
  useEffect(() => {
    if (settings && settings.locale !== i18n.language) {
      void i18n.changeLanguage(settings.locale)
    }
  }, [settings, i18n])

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'home', label: t('nav.home'), icon: '🏠' },
    { key: 'expenses', label: t('nav.expenses'), icon: '🧾' },
    { key: 'budget', label: t('nav.budget'), icon: '📊' },
    { key: 'reports', label: t('nav.reports'), icon: '📈' },
    { key: 'settings', label: t('nav.settings'), icon: '⚙️' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <div className="flex-1 pb-20">
        {tab === 'home' && <HomeScreen />}
        {tab === 'expenses' && <ExpensesScreen />}
        {tab === 'budget' && <BudgetScreen />}
        {tab === 'reports' && <ReportsScreen />}
        {tab === 'settings' && (
          <SettingsScreen
            onOpenCategories={() => setTab('categories')}
            onOpenIncome={() => setTab('income')}
          />
        )}
        {tab === 'categories' && <CategoriesScreen onBack={() => setTab('settings')} />}
        {tab === 'income' && <IncomeScreen onBack={() => setTab('settings')} />}
      </div>

      {pending > 0 && (
        <button
          onClick={() => void drainQueue()}
          className="fixed inset-x-0 top-0 z-40 bg-amber-500 py-1.5 text-center text-xs font-medium text-white"
        >
          ⏳ {pending} {t('offline.pending')}
        </button>
      )}

      {/* Floating add: always visible, one-thumb reach (spec §3.1, §6.1) */}
      <button
        onClick={() => setQuickAdd(true)}
        aria-label="+"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-3xl font-light text-white shadow-lg active:bg-emerald-700"
      >
        +
      </button>
      {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} />}

      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-lg justify-around">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs ${
                tab === item.key ? 'font-semibold text-emerald-700' : 'text-neutral-500'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
