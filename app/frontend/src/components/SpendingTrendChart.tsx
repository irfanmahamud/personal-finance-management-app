import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatTakaSigned, type Locale } from '../lib/money'
import { useSpendingTimeseries, type TimeseriesGranularity } from '../lib/queries'

const GRANULARITIES: TimeseriesGranularity[] = ['day', 'week', 'month']

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

/** Spending-over-time chart with a Day/Week/Month granularity toggle and
 * an optional custom date range - used on both the dashboard (compact)
 * and Reports (full, with the custom-range picker). */
export default function SpendingTrendChart({
  variant = 'full',
}: {
  variant?: 'compact' | 'full'
}) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const [granularity, setGranularity] = useState<TimeseriesGranularity>('day')
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(() => daysAgoStr(30))
  const [customTo, setCustomTo] = useState(() => todayStr())

  const { data } = useSpendingTimeseries(
    granularity,
    customOpen ? customFrom : undefined,
    customOpen ? customTo : undefined,
  )

  const chartData = (data?.points ?? []).map((p) => ({
    period:
      granularity === 'month'
        ? p.period.slice(0, 7)
        : new Date(p.period + 'T00:00').toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
            day: 'numeric',
            month: 'short',
          }),
    spent: p.spent / 100,
  }))

  return (
    <div className={variant === 'compact' ? '' : 'rounded-xl border border-neutral-200 bg-white p-3 shadow-sm'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className={
            variant === 'compact'
              ? 'text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400'
              : 'text-sm font-semibold text-neutral-900'
          }
        >
          {t('trend.title')}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-0.5">
            {GRANULARITIES.map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  granularity === g && !customOpen ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                }`}
              >
                {t(`trend.granularity.${g}`)}
              </button>
            ))}
          </div>
          {variant === 'full' && (
            <button
              onClick={() => setCustomOpen((v) => !v)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                customOpen ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {t('trend.custom')}
            </button>
          )}
        </div>
      </div>

      {customOpen && variant === 'full' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
          />
          <span className="text-xs text-neutral-400">–</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
          />
        </div>
      )}

      <div className={variant === 'compact' ? 'mt-2 h-28' : 'mt-3 h-52'}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={40} />
            <Tooltip formatter={(v) => `৳${Number(v).toLocaleString('en-IN')}`} />
            <Bar dataKey="spent" fill="#e2a33b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data && (
        <p className="mt-1 text-right text-xs text-neutral-400">
          {t('reports.expenses')}: {formatTakaSigned(data.total_spent, locale)}
        </p>
      )}
    </div>
  )
}
