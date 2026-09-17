import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, type Locale } from '@app/shared'
import { useCategoryReport, useExpenses, type CategorySpend } from '../lib/queries'

export type BreakdownPeriod = 'month' | 'year'

/**
 * Reports' "by category" drill-down, in two levels:
 *
 *   1. how much each sub-category of one top-level category took, and
 *   2. the individual expenses behind whichever sub-category you tap.
 *
 * Level 2 replaces level 1 inside the same panel rather than opening a second
 * sheet on top - stacked modals on a phone are a trap, and there is nothing on
 * level 1 worth keeping visible behind it.
 *
 * The period toggle exists because "how much do we spend on diapers?" is
 * almost never a question about one month. Month and fiscal year are the two
 * ranges the rest of the app already thinks in, so they are the two offered;
 * the fiscal-year dates are handed down from the yearly report rather than
 * recomputed here, so the fiscal-year-start setting is honoured in exactly
 * one place (services/periods.py::fiscal_year_range) instead of two.
 */
export default function CategoryBreakdownSheet({
  category,
  monthFrom,
  monthTo,
  yearFrom,
  yearTo,
  yearLabel,
  bn,
  locale,
  onClose,
}: {
  category: CategorySpend
  monthFrom: string
  monthTo: string
  yearFrom: string | undefined
  yearTo: string | undefined
  yearLabel: string | undefined
  bn: boolean
  locale: Locale
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<BreakdownPeriod>('month')
  const [sub, setSub] = useState<CategorySpend | null>(null)

  const hasYear = yearFrom != null && yearTo != null
  const from = period === 'year' && hasYear ? yearFrom : monthFrom
  const to = period === 'year' && hasYear ? yearTo : monthTo

  const { data, isLoading } = useCategoryReport(from, to, category.category_id)
  const sorted = [...(data?.subcategories ?? [])].sort((a, b) => b.spent - a.spent)

  // The headline figure has to come from the report for the SELECTED period -
  // the `spent` on the row that opened this sheet is the month's, and would
  // silently contradict the sub-category totals under it once the period
  // switches to the year.
  const total =
    data?.by_category.find((c) => c.category_id === category.category_id)?.spent ??
    (period === 'month' ? category.spent : 0)

  const title = sub
    ? ((bn ? sub.name_bn : sub.name_en) ?? '')
    : ((bn ? category.name_bn : category.name_en) ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/40 lg:items-center lg:justify-center lg:p-4"
      onClick={onClose}
    >
      <div
        className="mt-auto max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 lg:mt-0 lg:w-full lg:max-w-md lg:rounded-2xl lg:pb-4 lg:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {sub ? (
              <button
                onClick={() => setSub(null)}
                aria-label={t('common.back')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg text-neutral-500 hover:bg-neutral-200"
              >
                ‹
              </button>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl">
                {category.icon ?? '·'}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-neutral-900">{title}</p>
              <p className="truncate text-xs text-neutral-400">
                {sub
                  ? ((bn ? category.name_bn : category.name_en) ?? '')
                  : t('reports.byCategory')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('expenses.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-neutral-400 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>

        {hasYear && (
          <div className="mt-3 flex gap-1 rounded-lg bg-neutral-100 p-0.5">
            <PeriodTab
              selected={period === 'month'}
              onClick={() => setPeriod('month')}
              label={t('reports.thisMonth')}
            />
            <PeriodTab
              selected={period === 'year'}
              onClick={() => setPeriod('year')}
              label={yearLabel ?? t('reports.thisYear')}
            />
          </div>
        )}

        {sub ? (
          <SubCategoryExpenses sub={sub} from={from} to={to} bn={bn} locale={locale} />
        ) : (
          <>
            <p className="mt-3 break-words text-2xl font-bold tabular-nums text-neutral-900">
              {formatTakaSigned(total, locale)}
            </p>

            {isLoading ? (
              <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>
            ) : sorted.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-400">{t('budget.noSpendYet')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {sorted.map((s) => (
                  <li key={s.category_id ?? 'uncategorized'}>
                    <button
                      onClick={() => setSub(s)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">
                          {bn ? s.name_bn : s.name_en}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {t('budget.spentCount', { count: s.entries })}
                        </span>
                      </span>
                      <span className="shrink-0 break-words text-sm font-semibold tabular-nums text-neutral-900">
                        {formatTakaSigned(s.spent, locale)}
                      </span>
                      <span className="shrink-0 text-neutral-300">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PeriodTab({
  selected,
  onClick,
  label,
}: {
  selected: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 truncate rounded-md px-2 py-1 text-xs font-medium ${
        selected ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * Its own component so the expenses query is only mounted once a sub-category
 * is actually picked - a hook cannot be called conditionally, and fetching a
 * whole expense list behind every breakdown nobody drills into is wasteful.
 *
 * `category_id` on GET /expenses matches the category AND its children; a
 * sub-category has none, so this is exactly that sub-category's expenses.
 */
function SubCategoryExpenses({
  sub,
  from,
  to,
  bn,
  locale,
}: {
  sub: CategorySpend
  from: string
  to: string
  bn: boolean
  locale: Locale
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useExpenses({
    date_from: from,
    date_to: to,
    category_id: sub.category_id ?? undefined,
  })
  const items = [...(data?.items ?? [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <p className="mt-3 break-words text-2xl font-bold tabular-nums text-neutral-900">
        {formatTakaSigned(sub.spent, locale)}
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">{t('budget.noSpendYet')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-900">
                  {e.description || (bn ? sub.name_bn : sub.name_en)}
                </span>
                <span className="text-xs text-neutral-400">
                  {new Date(`${e.date}T00:00`).toLocaleDateString(bn ? 'bn-BD' : 'en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
              <span className="shrink-0 break-words text-sm font-semibold tabular-nums text-neutral-900">
                {formatTakaSigned(e.amount_bdt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
