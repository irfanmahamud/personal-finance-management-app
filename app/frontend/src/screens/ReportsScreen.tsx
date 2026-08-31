import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getAccessToken } from '../lib/api-client'
import { formatTakaSigned, type Locale } from '../lib/money'
import { useBudgetVariance, useMonthlyReport } from '../lib/queries'

const PALETTE = [
  '#059669', '#0284c7', '#d97706', '#dc2626', '#7c3aed',
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

      {report && (
        <>
          <section className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label={t('reports.income')} value={formatTakaSigned(report.income, locale)} />
            <Stat label={t('reports.expenses')} value={formatTakaSigned(report.total_spent, locale)} />
            <Stat
              label={report.surplus >= 0 ? t('reports.surplus') : t('reports.deficit')}
              value={formatTakaSigned(Math.abs(report.surplus), locale)}
              tone={report.surplus >= 0 ? 'text-emerald-700' : 'text-red-600'}
            />
          </section>

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

          <button
            onClick={() => void downloadCsv()}
            className="mt-6 w-full rounded-xl border border-neutral-300 bg-white py-3 text-sm font-medium text-neutral-700"
          >
            ⬇ {t('reports.exportCsv')}
          </button>
        </>
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
