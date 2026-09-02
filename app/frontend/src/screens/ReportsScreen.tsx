import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SpendingTrendChart from '../components/SpendingTrendChart'
import { getAccessToken } from '../lib/api-client'
import { formatTakaSigned, type Locale } from '../lib/money'
import {
  useBudgetVariance,
  useInsights,
  useMonthlyReport,
  useTaxEstimate,
  useYearlyReport,
  type Insight,
} from '../lib/queries'

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

const PALETTE = [
  '#e2a33b', '#0284c7', '#d97706', '#dc2626', '#7c3aed',
  '#db2777', '#0d9488', '#65a30d', '#ea580c', '#6366f1',
  '#a21caf', '#374151', '#b45309',
]

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ReportsScreen() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const { data: report } = useMonthlyReport(month)
  const { data: variance } = useBudgetVariance(month)
  const { data: yearly } = useYearlyReport()
  const { data: insights } = useInsights()
  // The tax estimate has no per-month history - only trustworthy as a
  // stand-in for gross income when looking at the current month.
  const isCurrentMonth = month === monthKey(new Date())
  const { data: tax } = useTaxEstimate(isCurrentMonth && (report?.income ?? 0) > 0)
  const usesNetIncome = isCurrentMonth && tax != null && tax.monthly_gross > 0
  const incomeBasis = usesNetIncome ? tax.monthly_net : (report?.income ?? 0)
  const incomeLabel = usesNetIncome ? t('income.netTakeHome') : t('reports.income')
  const surplus = incomeBasis - (report?.total_spent ?? 0)

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)))
  }

  async function downloadCsv() {
    if (!report) return
    // fetch with the auth header, then hand the blob to the browser.
    const res = await fetch(
      `/api/v1/export/csv?date_from=${report.period_start}&date_to=${report.period_end}`,
      { headers: { Authorization: `Bearer ${getAccessToken()}` } },
    )
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">{t('reports.title')}</h1>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => shiftMonth(-1)} className="rounded-full bg-neutral-200 px-3 py-1">
            {t('reports.prevMonth')}
          </button>
          <span className="font-medium text-neutral-700">{month}</span>
          <button onClick={() => shiftMonth(1)} className="rounded-full bg-neutral-200 px-3 py-1">
            {t('reports.nextMonth')}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <SpendingTrendChart variant="full" />
      </div>

      {(insights?.length ?? 0) > 0 && (
        <section className="mt-4 space-y-2">
          <h2 className="text-sm font-medium text-neutral-700">{t('insights.title')}</h2>
          {insights!.map((insight, i) => (
            <InsightCard key={i} insight={insight} locale={locale} />
          ))}
        </section>
      )}

      {report && (
        <div id="printable-report">
          <section className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label={incomeLabel} value={formatTakaSigned(incomeBasis, locale)} />
            <Stat label={t('reports.expenses')} value={formatTakaSigned(report.total_spent, locale)} />
            <Stat
              label={surplus >= 0 ? t('reports.surplus') : t('reports.deficit')}
              value={formatTakaSigned(Math.abs(surplus), locale)}
              tone={surplus >= 0 ? 'text-brand-700' : 'text-red-600'}
            />
          </section>
          {variance && variance.total_budgeted > 0 && (
            <p className="mt-2 text-center text-[11px] text-neutral-400">
              {t('reports.vsBudget', { budget: formatTakaSigned(variance.total_budgeted, locale) })}
            </p>
          )}

          {report.by_category.length === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-400">{t('reports.noData')}</p>
          ) : (
            <>
              <h2 className="mt-6 text-sm font-medium text-neutral-700">
                {t('reports.byCategory')}
              </h2>
              <div className="mt-2 h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={report.by_category.map((c) => ({
                        name: bn ? c.name_bn : c.name_en,
                        value: c.spent / 100,
                      }))}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {report.by_category.map((c, i) => (
                        <Cell key={c.category_id} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `৳${Number(v).toLocaleString('en-IN')}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1">
                {report.by_category.map((c, i) => (
                  <li key={c.category_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-neutral-700">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: PALETTE[i % PALETTE.length] }}
                      />
                      {c.icon} {bn ? c.name_bn : c.name_en}
                      <span className="text-xs text-neutral-400">
                        {c.entries} {t('reports.entries')}
                      </span>
                    </span>
                    <span className="font-medium text-neutral-900">
                      {formatTakaSigned(c.spent, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {variance && (
            <>
              <h2 className="mt-6 text-sm font-medium text-neutral-700">
                {t('reports.variance')}
              </h2>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
                {variance.lines.map((l) => (
                  <li key={l.category_id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-neutral-700">
                      {l.icon} {bn ? l.name_bn : l.name_en}
                    </span>
                    <span
                      className={`font-medium ${l.variance < 0 ? 'text-red-600' : 'text-neutral-900'}`}
                    >
                      {formatTakaSigned(l.spent, locale)} / {formatTakaSigned(l.budgeted, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {yearly && (
            <>
              <h2 className="mt-6 text-sm font-medium text-neutral-700">
                {t('reports.yearly')} ({yearly.fiscal_year})
              </h2>
              <div className="mt-2 h-44">
                <ResponsiveContainer>
                  <BarChart data={yearly.months.map((m) => ({
                    month: m.month.slice(0, 7),
                    income: m.income / 100,
                    spent: m.spent / 100,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={45} />
                    <Tooltip formatter={(v) => `৳${Number(v).toLocaleString('en-IN')}`} />
                    <Bar dataKey="income" fill="#0284c7" />
                    <Bar dataKey="spent" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-500">
                <span>
                  {t('reports.income')}: {formatTakaSigned(yearly.total_income, locale)}
                </span>
                <span>
                  {t('reports.expenses')}: {formatTakaSigned(yearly.total_spent, locale)}
                </span>
                <span className={yearly.total_surplus >= 0 ? 'text-brand-700' : 'text-red-600'}>
                  {t('reports.surplus')}: {formatTakaSigned(yearly.total_surplus, locale)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {report && (
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => void downloadCsv()}
            className="flex-1 rounded-xl border border-neutral-300 bg-white py-3 text-sm font-medium text-neutral-700"
          >
            ⬇ {t('reports.exportCsv')}
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl border border-neutral-300 bg-white py-3 text-sm font-medium text-neutral-700"
          >
            ⬇ {t('reports.exportPdf')}
          </button>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${tone}`}>{value}</p>
    </div>
  )
}

/** Deterministic insights (spec §4.2 rows 1-5) - the backend returns typed
 * numbers only; every message is composed here via i18n interpolation,
 * same as the rest of the app. Never on HomeScreen (CLAUDE.md dashboard
 * rule) - this screen is where it lives instead. */
function InsightCard({ insight, locale }: { insight: Insight; locale: Locale }) {
  const { t } = useTranslation()
  const bn = locale === 'bn'
  const category = bn ? insight.category_name_bn : insight.category_name_en
  const tone = insight.severity === 'warning' ? 'bg-red-50 text-red-800' : 'bg-brand-50 text-brand-800'

  let message: string | null = null
  if (insight.type === 'overspend' && category != null) {
    message = t('insights.overspend', { category, pct: insight.pct, days: insight.days_left })
  } else if (insight.type === 'pattern' && insight.weekday != null) {
    message = t('insights.pattern', {
      pct: insight.extra_pct,
      weekday: t(`insights.weekdays.${WEEKDAY_KEYS[insight.weekday]}`),
    })
  } else if (insight.type === 'anomaly' && category != null) {
    message = t('insights.anomaly', { category, multiplier: insight.multiplier })
  } else if (insight.type === 'savings_opportunity' && category != null) {
    message = t('insights.savingsOpportunity', {
      category,
      cut: formatTakaSigned(insight.cut_amount ?? 0, locale),
      annual: formatTakaSigned(insight.annual_savings ?? 0, locale),
    })
  } else if (insight.type === 'goal_projection') {
    const goalName = bn && insight.goal_name_bn ? insight.goal_name_bn : insight.goal_name
    message = t('insights.goalProjection', { goal: goalName, months: insight.months_remaining })
  }
  if (!message) return null

  return <div className={`rounded-xl px-4 py-3 text-sm ${tone}`}>{message}</div>
}
