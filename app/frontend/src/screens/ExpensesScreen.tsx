import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmationBanner from '../components/ConfirmationBanner'
import ExpenseDetailSheet from '../components/ExpenseDetailSheet'
import { Chip } from '../components/ExpenseEntryPanel'
import DescriptionInput from '../components/DescriptionInput'
import { IconChevronLeft, IconChevronRight } from '../components/icons'
import { formatTakaSigned, parseTakaInput, type Locale } from '@app/shared'
import {
  fetchReceiptUrl,
  useCategories,
  useCurrentBudget,
  useDescriptionSuggestions,
  useExpenses,
  useMembers,
  usePatchExpense,
  useUploadReceipt,
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

// Monday-start week bucket key, so a spanning week groups correctly even
// when it crosses into the next/previous month's data (out of view here,
// but keeps the key stable if date ranges widen later).
function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00')
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

/** Ledger per the redesign mock: month navigator, stat tiles, day-grouped
 * bordered cards with icon tiles and "For" chips, hover edit/delete,
 * brand-tinted inline edit. */
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
  const [detailId, setDetailId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'day' | 'week'>('day')
  const [memberFilter, setMemberFilter] = useState<'all' | 'household' | string>('all')
  // '' = every category. 'uncategorized' is its own value because the
  // category_id query param cannot express "category_id IS NULL" - the same
  // gap the member filter's "Household" option works around.
  const [categoryFilter, setCategoryFilter] = useState<string>('')

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

  const filteredItems = useMemo(() => {
    let items = data?.items ?? []
    if (memberFilter === 'household') items = items.filter((e) => !e.for_member_id)
    else if (memberFilter !== 'all') items = items.filter((e) => e.for_member_id === memberFilter)

    if (categoryFilter === 'uncategorized') items = items.filter((e) => e.category_id == null)
    else if (categoryFilter) items = items.filter((e) => e.category_id === categoryFilter)
    return items
  }, [data, memberFilter, categoryFilter])

  // Filtering client-side (like the member filter) rather than refetching with
  // category_id keeps "Uncategorized" expressible and means this total always
  // matches the rows actually on screen.
  const filteredTotal = useMemo(
    () => filteredItems.reduce((sum, e) => sum + e.amount_bdt, 0),
    [filteredItems],
  )
  const isFiltered = categoryFilter !== '' || memberFilter !== 'all'

  const byDate = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of filteredItems) {
      const key = groupBy === 'week' ? weekKey(e.date) : e.date
      const group = map.get(key) ?? []
      group.push(e)
      map.set(key, group)
    }
    return map
  }, [filteredItems, groupBy])

  const categoryOptions = useMemo(
    () =>
      (tree ?? []).map((parent) => ({
        id: parent.id,
        label: `${parent.icon ?? ''} ${bn ? parent.name_bn : parent.name_en}`,
        children: parent.children.map((sub) => ({
          id: sub.id,
          label: bn ? sub.name_bn : sub.name_en,
        })),
      })),
    [tree, bn],
  )

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
            tone={budget.total_amount - budget.total_spent < 0 ? 'text-red-600' : 'text-brand-600'}
          />
        </div>
      )}

      {isFiltered && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-brand-700">
            {t('expenses.filteredTotal')}
          </span>
          <span className="shrink-0 break-words text-base font-bold tabular-nums text-brand-800">
            {formatTakaSigned(filteredTotal, locale)}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-0.5">
          {(['day', 'week'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                groupBy === g ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
              }`}
            >
              {t(`expenses.groupBy.${g}`)}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label={t('entry.category')}
          className="max-w-[60%] rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
        >
          <option value="">{t('expenses.allCategories')}</option>
          {categoryOptions.map((parent) => (
            <optgroup key={parent.id} label={parent.label}>
              {parent.children.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.label}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="uncategorized">{t('budget.uncategorized')}</option>
        </select>

        {(members?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={memberFilter === 'all'} onClick={() => setMemberFilter('all')}>
              {t('expenses.all')}
            </Chip>
            <Chip selected={memberFilter === 'household'} onClick={() => setMemberFilter('household')}>
              {t('entry.household')}
            </Chip>
            {members!.map((m) => (
              <Chip key={m.id} selected={memberFilter === m.id} onClick={() => setMemberFilter(m.id)}>
                {bn && m.name_bn ? m.name_bn : m.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {isLoading && <p className="mt-6 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && filteredItems.length === 0 && (
        <p className="mt-10 text-center text-sm text-neutral-400">{t('expenses.empty')}</p>
      )}

      {[...byDate.entries()].map(([groupKey, items]) => {
        const groupTotal = items.reduce((sum, e) => sum + e.amount_bdt, 0)
        const groupLabel =
          groupBy === 'week'
            ? (() => {
                const start = new Date(groupKey + 'T00:00')
                const end = new Date(start)
                end.setDate(end.getDate() + 6)
                const fmt = (d: Date) =>
                  d.toLocaleDateString(bn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' })
                return `${fmt(start)} – ${fmt(end)}`
              })()
            : new Date(groupKey + 'T00:00').toLocaleDateString(bn ? 'bn-BD' : 'en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
        return (
          <section key={groupKey} className="mt-5">
            <div className="flex items-baseline justify-between px-1 pb-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
                {groupLabel}
              </span>
              <span className="text-xs font-medium tabular-nums text-neutral-400">
                {formatTakaSigned(groupTotal, locale)}
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
                    icon={(e.category_id ? iconOf.get(e.category_id) : null) ?? null}
                    onOpen={() => setDetailId(e.id)}
                  />
                ),
              )}
            </ul>
          </section>
        )
      })}

      {detailId && (() => {
        const e = filteredItems.find((x) => x.id === detailId)
        if (!e) return null
        return (
          <ExpenseDetailSheet
            expense={e}
            bn={bn}
            locale={locale}
            icon={(e.category_id ? iconOf.get(e.category_id) : null) ?? null}
            forLabel={
              e.for_member_id
                ? (memberName.get(e.for_member_id) ?? t('entry.household'))
                : t('entry.household')
            }
            onClose={() => setDetailId(null)}
            onEdit={() => {
              setDetailId(null)
              setEditingId(e.id)
            }}
          />
        )
      })()}
    </div>
  )
}

function StatTile({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-neutral-200 bg-white px-3 py-3.5 shadow-sm">
      <span className="truncate text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className={`break-words text-lg font-bold tabular-nums ${tone}`}>{value}</span>
    </div>
  )
}

// Two-line layout keeps category + note fully readable on a narrow phone -
// a single crowded row (icon + name/note + for-chip + amount + two icon
// buttons) squeezed the name/note column down to almost nothing. Edit/
// delete moved into the detail sheet (opened by tapping the row) instead
// of sitting inline here, freeing up the width they used to take.
function Row({
  expense: e,
  bn,
  locale,
  icon,
  onOpen,
}: {
  expense: Expense
  bn: boolean
  locale: Locale
  icon: string | null
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full flex-col gap-1 px-3.5 py-2.5 text-left hover:bg-neutral-100/70"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-base">
            {icon ?? '·'}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
            {e.category_id ? (bn ? e.category_name_bn : e.category_name_en) : t('budget.uncategorized')}
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
            {formatTakaSigned(e.amount_bdt, locale)}
          </span>
        </span>
        {e.description && (
          <span className="truncate pl-11 text-xs text-neutral-400">{e.description}</span>
        )}
      </button>
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
  const uploadReceipt = useUploadReceipt()
  const { data: members } = useMembers()
  const { data: tree } = useCategories()
  const [categoryId, setCategoryId] = useState<string | null>(e.category_id)
  const { data: suggestions } = useDescriptionSuggestions(categoryId)
  const [amountText, setAmountText] = useState(String(e.amount / 100))
  const [description, setDescription] = useState(e.description ?? '')
  const [date, setDate] = useState(e.date)
  const [memberId, setMemberId] = useState<string | null>(e.for_member_id)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  // Only leaf sub-categories are assignable to expenses (same rule as
  // ExpenseEntryPanel) - flatten with the parent's icon/name for display.
  const subcategories = useMemo(() => {
    if (!tree) return []
    const flat: { id: string; label: string; icon: string | null }[] = []
    for (const parent of tree) {
      for (const sub of parent.children) {
        flat.push({ id: sub.id, label: `${bn ? parent.name_bn : parent.name_en} / ${bn ? sub.name_bn : sub.name_en}`, icon: parent.icon })
      }
    }
    return flat
  }, [tree, bn])

  function save() {
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    patch.mutate(
      { id: e.id, amount, description: description || null, date, for_member_id: memberId, category_id: categoryId },
      {
        onSuccess: () => {
          setSavedMessage(t('entry.updated'))
          // Give the user a beat to see the confirmation before the row
          // reverts from edit mode back to a plain display row.
          setTimeout(onDone, 900)
        },
      },
    )
  }

  function onReceiptPicked(file: File | undefined) {
    if (!file) return
    uploadReceipt.mutate(file, {
      onSuccess: (receipt) => patch.mutate({ id: e.id, receipt_id: receipt.id }),
    })
  }

  async function viewReceipt() {
    if (!e.receipt_id) return
    const url = await fetchReceiptUrl(e.receipt_id)
    window.open(url, '_blank')
  }

  return (
    <li className="flex flex-col gap-2.5 bg-brand-50 p-3.5">
      {savedMessage && <ConfirmationBanner message={savedMessage} />}
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
        <select
          value={categoryId ?? ''}
          onChange={(ev) => setCategoryId(ev.target.value || null)}
          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm"
        >
          {e.category_id == null ? (
            // Its sub-category was deleted - keep "Uncategorized" selectable
            // so saving something else doesn't silently recategorize it.
            <option value="">{t('budget.uncategorized')}</option>
          ) : (
            !subcategories.some((s) => s.id === e.category_id) && (
              // The expense's current category is archived (or otherwise not
              // in the active tree) - keep it selectable so saving doesn't
              // silently reassign it to whatever option happens to be first.
              <option value={e.category_id}>
                {bn ? e.category_name_bn : e.category_name_en}
              </option>
            )
          )}
          {subcategories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
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
            disabled={patch.isPending || savedMessage != null}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {t('expenses.save')}
          </button>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        {e.receipt_id && (
          <button onClick={() => void viewReceipt()} className="font-medium text-brand-700">
            📎 {t('expenses.viewReceipt')}
          </button>
        )}
        <label className="cursor-pointer font-medium text-neutral-500">
          {uploadReceipt.isPending
            ? t('expenses.uploading')
            : e.receipt_id
              ? t('expenses.replaceReceipt')
              : t('expenses.addReceipt')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(ev) => onReceiptPicked(ev.target.files?.[0])}
          />
        </label>
        {uploadReceipt.isError && (
          <span className="text-red-600">{t('expenses.receiptFailed')}</span>
        )}
      </div>
    </li>
  )
}
