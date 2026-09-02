import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, type Locale } from '../lib/money'
import { useMarkRecurringPaid, useRecurringRules } from '../lib/queries'
import { IconBell } from './icons'

// How many days ahead a due recurring item (bill, or an investment's
// contribution schedule) starts surfacing here - independent of
// RecurringScreen's own "due_soon" badge threshold (that one is 3 days;
// this panel is deliberately narrower per the explicit "2 days beforehand"
// notification requirement).
const NOTIFY_DAYS_BEFORE = 2

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

/** Global due-item notifications (bills + investment contribution
 * schedules, since both are just `recurring_rule` rows) - a bell in the
 * app chrome, visible from every screen, not just the dashboard's own
 * "Bills due" card. */
export default function NotificationBell() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: rules } = useRecurringRules()
  const markPaid = useMarkRecurringPaid()

  const due = useMemo(
    () =>
      (rules ?? [])
        .filter((r) => r.active && daysUntil(r.next_due_date) <= NOTIFY_DAYS_BEFORE)
        .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)),
    [rules],
  )

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function dueLabel(dateStr: string) {
    const d = daysUntil(dateStr)
    if (d < 0) return t('notifications.overdueBy', { count: -d })
    if (d === 0) return t('notifications.dueToday')
    return t('notifications.dueInDays', { count: d })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.title')}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
      >
        <IconBell size={18} />
        {due.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {due.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {t('notifications.title')}
          </p>
          {due.length === 0 ? (
            <p className="px-2 py-3 text-sm text-neutral-400">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {due.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-neutral-50"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-900">
                      {r.icon} {r.name}
                    </span>
                    <span className="block text-[11px] text-neutral-400">
                      {dueLabel(r.next_due_date)}
                      {r.investment_name && ` · ${r.investment_name}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-neutral-700">
                      {formatTakaSigned(r.amount, locale)}
                    </span>
                    <button
                      disabled={markPaid.isPending}
                      onClick={() => markPaid.mutate({ id: r.id })}
                      className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                    >
                      {t('recurring.markPaid')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
