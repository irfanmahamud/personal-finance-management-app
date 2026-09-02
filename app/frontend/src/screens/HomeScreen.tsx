import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import SpendingTrendChart from '../components/SpendingTrendChart'
import { formatTakaSigned, type Locale } from '../lib/money'
import {
  useCurrentBudget,
  useExpenses,
  useMarkRecurringPaid,
  useMonthlyReport,
  useRecurringRules,
  useSettings,
  useTaxEstimate,
} from '../lib/queries'

const BrandEmblem3D = lazy(() => import('../components/BrandEmblem3D'))

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Dashboard (spec §3.1): the month's numbers as the largest element, the
 * color-coded health bar, today's total, income vs. spent so far, a
 * spending-trend chart, top 3 categories nearing limits. No AI insight
 * card, no net-worth ticker - not even placeholders (CLAUDE.md dashboard
 * rule); income-vs-spent is a plain logged figure, not an insight.
 */
export default function HomeScreen() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const { data: budget } = useCurrentBudget()
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayData } = useExpenses({ date_from: today, date_to: today })
  const { data: recurring } = useRecurringRules()
  const { data: settings } = useSettings()
  const { data: report } = useMonthlyReport(monthKey(new Date()))
  const { data: tax } = useTaxEstimate((report?.income ?? 0) > 0)
  const markPaid = useMarkRecurringPaid()
  const billsDue = (recurring ?? []).filter(
    (r) => r.status === 'overdue' || r.status === 'due_today' || r.status === 'due_soon',
  )

  const spent = budget?.total_spent ?? 0
  const total = budget?.total_amount ?? 0
  const remaining = total - spent
  const ratio = total > 0 ? spent / total : 0
  const barColor = ratio >= 0.95 ? 'bg-red-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-brand-500'
  const todayTotal = (todayData?.items ?? []).reduce((sum, e) => sum + e.amount_bdt, 0)

  // Net take-home (after TDS + deductions) is the money that actually
  // reaches the household - a better basis for "what's left" than gross
  // income. Falls back to gross when there's no usable tax estimate yet
  // (no income sources configured, or nothing taxable set up).
  const usesNetIncome = tax != null && tax.monthly_gross > 0
  const incomeBasis = usesNetIncome ? tax.monthly_net : (report?.income ?? 0)
  const incomeLabel = usesNetIncome ? t('income.netTakeHome') : t('reports.income')
  const surplus = incomeBasis - (report?.total_spent ?? 0)
  const alerts = (budget?.lines ?? [])
    .filter((l) => l.status !== 'ok')
    .sort((a, b) => b.spent / Math.max(1, b.amount + b.rolled_over_amount) - a.spent / Math.max(1, a.amount + a.rolled_over_amount))
    .slice(0, 3)

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      {settings?.eid_mode_enabled && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          🌙 {t('settings.eidModeBanner')}
        </div>
      )}

      {budget ? (
        <>
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">{t('budget.remaining')}</p>
          <p className={`text-4xl font-bold tabular-nums ${remaining < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
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

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
          {t('expenses.today')}
        </h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {formatTakaSigned(todayTotal, locale)}
        </p>
      </section>

      {report && report.income > 0 && (
        <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {incomeLabel}
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-neutral-900">
                {formatTakaSigned(incomeBasis, locale)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {t('reports.expenses')}
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-neutral-900">
                {formatTakaSigned(report.total_spent, locale)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {surplus >= 0 ? t('reports.surplus') : t('reports.deficit')}
              </p>
              <p
                className={`mt-1 text-base font-semibold tabular-nums ${
                  surplus >= 0 ? 'text-brand-700' : 'text-red-600'
                }`}
              >
                {formatTakaSigned(Math.abs(surplus), locale)}
              </p>
            </div>
          </div>
          {total > 0 && (
            <p className="mt-2 text-center text-[11px] text-neutral-400">
              {t('reports.vsBudget', { budget: formatTakaSigned(total, locale) })}
            </p>
          )}
        </section>
      )}

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <SpendingTrendChart variant="compact" />
      </section>

      {billsDue.length > 0 && (
        <section className="mt-4 space-y-2">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
            {t('recurring.billsDue')}
          </h2>
          {billsDue.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ${
                r.status === 'overdue' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              <span>
                {r.icon} {r.name} — {formatTakaSigned(r.amount, locale)}
              </span>
              <button
                disabled={markPaid.isPending}
                onClick={() => markPaid.mutate({ id: r.id })}
                className="whitespace-nowrap rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm disabled:opacity-40"
              >
                {t('recurring.markPaid')}
              </button>
            </div>
          ))}
        </section>
      )}

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

      <Suspense fallback={<div className="mt-6 h-[220px] w-full rounded-xl bg-[#241d16]" />}>
        <BrandEmblem3D className="mt-6" />
      </Suspense>
    </main>
  )
}
