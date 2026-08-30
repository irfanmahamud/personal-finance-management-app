import { useTranslation } from 'react-i18next'
import { formatTakaSigned, type Locale } from '../lib/money'
import { useCurrentBudget, useExpenses } from '../lib/queries'

/**
 * Dashboard (spec §3.1): the month's numbers as the largest element, the
 * color-coded health bar, today's total, top 3 categories nearing limits.
 * (Income vs. spent swaps in when M6 lands; until then the budget total is
 * the denominator.) No AI card, no net-worth ticker - not even placeholders.
 */
export default function HomeScreen() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const { data: budget } = useCurrentBudget()
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayData } = useExpenses({ date_from: today, date_to: today })

  const spent = budget?.total_spent ?? 0
  const total = budget?.total_amount ?? 0
  const remaining = total - spent
  const ratio = total > 0 ? spent / total : 0
  const barColor = ratio >= 0.95 ? 'bg-red-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-emerald-500'
  const todayTotal = (todayData?.items ?? []).reduce((sum, e) => sum + e.amount_bdt, 0)
  const alerts = (budget?.lines ?? [])
    .filter((l) => l.status !== 'ok')
    .sort((a, b) => b.spent / Math.max(1, b.amount + b.rolled_over_amount) - a.spent / Math.max(1, a.amount + a.rolled_over_amount))
    .slice(0, 3)

  return (
    <main className="mx-auto max-w-lg p-4">
      {budget ? (
        <>
          <p className="text-sm text-neutral-500">{t('budget.remaining')}</p>
          <p className={`text-4xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
            {formatTakaSigned(remaining, locale)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {t('budget.spent')} {formatTakaSigned(spent, locale)} {t('budget.of')}{' '}
            {formatTakaSigned(total, locale)}
          </p>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
        </>
      ) : (
        <p className="text-sm text-neutral-400">{t('budget.noBudget')}</p>
      )}

      <section className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {t('expenses.today')}
        </h2>
        <p className="mt-1 text-2xl font-semibold text-neutral-900">
          {formatTakaSigned(todayTotal, locale)}
        </p>
      </section>

      {alerts.length > 0 && (
        <section className="mt-4 space-y-2">
          {alerts.map((l) => (
            <div
              key={l.id}
              className={`rounded-xl px-4 py-3 text-sm ${
                l.status === 'warn95' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {l.icon} {bn ? l.category_name_bn : l.category_name_en}:{' '}
              {formatTakaSigned(l.spent, locale)} / {formatTakaSigned(l.amount + l.rolled_over_amount, locale)}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
