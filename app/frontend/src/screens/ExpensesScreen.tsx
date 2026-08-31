import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '../components/ExpenseEntryPanel'
import DescriptionInput from '../components/DescriptionInput'
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconTrash,
} from '../components/icons'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCategories,
  useCurrentBudget,
  useDeleteExpense,
  useDescriptionSuggestions,
  useExpenses,
  useMembers,
  usePatchExpense,
  type Expense,
} from '../lib/queries'

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` }
}

/** Ledger per the redesign mock: month navigator, stat tiles, day-grouped
 * bordered cards with icon tiles and "For" chips, hover edit/delete,
 * emerald-tinted inline edit. */
export default function ExpensesScreen() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const range = monthRange(month)
  const { data, isLoading } = useExpenses({ date_from: range.from, date_to: range.to })
  const { data: budget } = useCurrentBudget()
  const { data: tree } = useCategories()
  const { data: members } = useMembers()
  const [editingId, setEditingId] = useState<string | null>(null)

  const currentMonth = month === monthKey(new Date())

  // sub-category id -> parent emoji, for the row icon tiles
  const iconOf = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const parent of tree ?? []) {
      map.set(parent.id, parent.icon)
      for (const sub of parent.children) map.set(sub.id, parent.icon)
    }
    return map
  }, [tree])

  const memberName = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members ?? []) map.set(m.id, bn && m.name_bn ? m.name_bn : m.name)
    return map
  }, [members, bn])

  const byDate = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of data?.items ?? []) {
      const group = map.get(e.date) ?? []
      group.push(e)
      map.set(e.date, group)
    }
    return map
  }, [data])

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)))
  }

  const monthLabel = new Date(`${month}-01T00:00`).toLocaleDateString(
    bn ? 'bn-BD' : 'en-GB',
    { month: 'long', year: 'numeric' },
  )

  return (
    <div className="mx-auto max-w-2xl p-4 lg:mx-0 lg:max-w-none lg:p-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">{t('expenses.title')}</h1>
        <div className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label={t('reports.prevMonth')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100"
          >
            <IconChevronLeft />
          </button>
          <span className="px-2.5 text-[13px] font-semibold">{monthLabel}</span>
          <button
            onClick={() => shiftMonth(1)}
            aria-label={t('reports.nextMonth')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100"
          >
            <IconChevronRight />
          </button>
        </div>
      </div>

      {/* Stat tiles - budget figures only exist for the current month */}
      {currentMonth && budget && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile label={t('entry.budgeted')} value={formatTakaSigned(budget.total_amount, locale)} />
          <StatTile label={t('entry.spent')} value={formatTakaSigned(budget.total_spent, locale)} />
          <StatTile
            label={t('entry.remaining')}
            value={formatTakaSigned(budget.total_amount - budget.total_spent, locale)}
            tone={budget.total_amount - budget.total_spent < 0 ? 'text-red-600' : 'text-emerald-600'}
          />
        </div>
      )}

      {isLoading && <p className="mt-6 text-sm text-neutral-400">{t('common.loading')}</p>}
      {data?.total === 0 && (
        <p className="mt-10 text-center text-sm text-neutral-400">{t('expenses.empty')}</p>
      )}

      {[...byDate.entries()].map(([date, items]) => {
        const dayTotal = items.reduce((sum, e) => sum + e.amount_bdt, 0)
        return (
          <section key={date} className="mt-5">
            <div className="flex items-baseline justify-between px-1 pb-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
                {new Date(date + 'T00:00').toLocaleDateString(bn ? 'bn-BD' : 'en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="text-xs font-medium tabular-nums text-neutral-400">
                {formatTakaSigned(dayTotal, locale)}
              </span>
            </div>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              {items.map((e) =>
                editingId === e.id ? (
                  <EditRow key={e.id} expense={e} bn={bn} onDone={() => setEditingId(null)} />
                ) : (
                  <Row
                    key={e.id}
                    expense={e}
                    bn={bn}
                    locale={locale}
                    icon={iconOf.get(e.category_id) ?? null}
                    forLabel={
                      e.for_member_id
                        ? (memberName.get(e.for_member_id) ?? t('entry.household'))
                        : t('entry.household')
                    }
                    onEdit={() => setEditingId(e.id)}
                  />
                ),
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function StatTile({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className={`text-xl font-bold tabular-nums ${tone}`}>{value}</span>
    </div>
  )
}

function Row({
  expense: e,
  bn,
  locale,
  icon,
  forLabel,
  onEdit,
}: {
  expense: Expense
  bn: boolean
  locale: Locale
  icon: string | null
  forLabel: string
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const del = useDeleteExpense()

  return (
    <li className="group flex min-h-[52px] items-center gap-3 px-3.5 py-2.5 hover:bg-neutral-100/70">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-base">
        {icon ?? '·'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-neutral-900">
          {bn ? e.category_name_bn : e.category_name_en}
        </span>
        {e.description && (
          <span className="truncate text-xs text-neutral-400">{e.description}</span>
        )}
      </span>
      <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-500">
        {forLabel}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
        {formatTakaSigned(e.amount_bdt, locale)}
      </span>
      <span className="flex shrink-0 gap-1.5 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
        <button
          onClick={onEdit}
          aria-label={t('expenses.edit')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
        >
          <IconEdit />
        </button>
        <button
          onClick={() => {
            if (confirm(t('expenses.confirmDelete'))) del.mutate(e.id)
          }}
          aria-label={t('expenses.delete')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-red-600 hover:bg-red-50"
        >
          <IconTrash />
        </button>
      </span>
    </li>
  )
}

function EditRow({
  expense: e,
  bn,
  onDone,
}: {
  expense: Expense
  bn: boolean
  onDone: () => void
}) {
  const { t } = useTranslation()
  const patch = usePatchExpense()
  const { data: members } = useMembers()
  const { data: suggestions } = useDescriptionSuggestions(e.category_id)
  const [amountText, setAmountText] = useState(String(e.amount / 100))
  const [description, setDescription] = useState(e.description ?? '')
  const [date, setDate] = useState(e.date)
  const [memberId, setMemberId] = useState<string | null>(e.for_member_id)

  function save() {
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    patch.mutate(
      { id: e.id, amount, description: description || null, date, for_member_id: memberId },
      { onSuccess: onDone },
    )
  }

  return (
    <li className="flex flex-col gap-2.5 bg-emerald-50 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          value={amountText}
          onChange={(ev) => setAmountText(ev.target.value)}
          className="w-28 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm tabular-nums"
        />
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm"
        />
        <div className="min-w-40 flex-1">
          <DescriptionInput
            value={description}
            onChange={setDescription}
            suggestions={suggestions}
            placeholder={t('expenses.description')}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1.5">
          <Chip selected={memberId === null} onClick={() => setMemberId(null)}>
            {t('entry.household')}
          </Chip>
          {members?.map((m) => (
            <Chip key={m.id} selected={memberId === m.id} onClick={() => setMemberId(m.id)}>
              {bn && m.name_bn ? m.name_bn : m.name}
            </Chip>
          ))}
        </span>
        <span className="flex gap-2">
          <button
            onClick={onDone}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-1.5 text-[13px] font-semibold text-neutral-500"
          >
            {t('expenses.cancel')}
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[13px] font-semibold text-white"
          >
            {t('expenses.save')}
          </button>
        </span>
      </div>
    </li>
  )
}
