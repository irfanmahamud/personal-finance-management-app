import { useTranslation } from 'react-i18next'
import { formatTakaSigned, type Locale } from '../lib/money'
import type { CategorySpend } from '../lib/queries'

/** Reports' "by category" drill-down: how much was spent in each
 * sub-category of one top-level category, for the same date range as the
 * report - not a list of individual expenses (see CategorySpendSheet for
 * that, budget-scoped). Same bottom-sheet-on-mobile/centered-on-desktop
 * shape as every other read-only drill-down in the app. */
export default function CategoryBreakdownSheet({
  title,
  icon,
  total,
  subcategories,
  bn,
  locale,
  isLoading,
  onClose,
}: {
  title: string
  icon: string | null
  total: number
  subcategories: CategorySpend[]
  bn: boolean
  locale: Locale
  isLoading: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const sorted = [...subcategories].sort((a, b) => b.spent - a.spent)

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
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl">
              {icon ?? '·'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-neutral-900">{title}</p>
              <p className="text-xs text-neutral-400">
                {t('reports.byCategory')}
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

        <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-900">
          {formatTakaSigned(total, locale)}
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>
        ) : sorted.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">{t('budget.noSpendYet')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {sorted.map((s) => (
              <li key={s.category_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {bn ? s.name_bn : s.name_en}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {t('budget.spentCount', { count: s.entries })}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
                  {formatTakaSigned(s.spent, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
