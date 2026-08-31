import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useDeleteExpense,
  useDescriptionSuggestions,
  useExpenses,
  usePatchExpense,
  type Expense,
} from '../lib/queries'
import DescriptionInput from '../components/DescriptionInput'

export default function ExpensesScreen() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const { data, isLoading } = useExpenses()
  const [editingId, setEditingId] = useState<string | null>(null)

  const byDate = new Map<string, Expense[]>()
  for (const e of data?.items ?? []) {
    const group = byDate.get(e.date) ?? []
    group.push(e)
    byDate.set(e.date, group)
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold text-neutral-900">{t('expenses.title')}</h1>
      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {data?.total === 0 && (
        <p className="mt-8 text-center text-sm text-neutral-400">{t('expenses.empty')}</p>
      )}
      {[...byDate.entries()].map(([date, items]) => (
        <section key={date} className="mt-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {new Date(date + 'T00:00').toLocaleDateString(bn ? 'bn-BD' : 'en-GB')}
          </h2>
          <ul className="mt-1 divide-y divide-neutral-100 rounded-xl bg-white shadow-sm">
            {items.map((e) =>
              editingId === e.id ? (
                <EditRow key={e.id} expense={e} onDone={() => setEditingId(null)} />
              ) : (
                <Row key={e.id} expense={e} bn={bn} locale={locale} onEdit={() => setEditingId(e.id)} />
              ),
            )}
          </ul>
        </section>
      ))}
    </main>
  )
}

function Row({
  expense: e,
  bn,
  locale,
  onEdit,
}: {
  expense: Expense
  bn: boolean
  locale: Locale
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const del = useDeleteExpense()

  return (
    <li className="flex items-center justify-between px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">
          {bn ? e.category_name_bn : e.category_name_en}
        </p>
        {e.description && (
          <p className="truncate text-xs text-neutral-500">{e.description}</p>
        )}
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-3">
        <span className="font-semibold text-neutral-900">
          {formatTakaSigned(e.amount_bdt, locale)}
        </span>
        <button onClick={onEdit} className="text-xs text-neutral-400">
          {t('expenses.edit')}
        </button>
        <button
          onClick={() => {
            if (confirm(t('expenses.confirmDelete'))) del.mutate(e.id)
          }}
          className="text-xs text-red-400"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

function EditRow({ expense: e, onDone }: { expense: Expense; onDone: () => void }) {
  const { t } = useTranslation()
  const patch = usePatchExpense()
  const [amountText, setAmountText] = useState(String(e.amount / 100))
  const [description, setDescription] = useState(e.description ?? '')
  const [date, setDate] = useState(e.date)
  // Suggestions narrowed to this expense's category.
  const { data: suggestions } = useDescriptionSuggestions(e.category_id)

  function save() {
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    patch.mutate(
      { id: e.id, amount, description: description || null, date },
      { onSuccess: onDone },
    )
  }

  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={amountText}
          onChange={(ev) => setAmountText(ev.target.value)}
          className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </div>
      <DescriptionInput
        value={description}
        onChange={setDescription}
        suggestions={suggestions}
        placeholder={t('expenses.description')}
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <div className="flex gap-3 text-sm">
        <button onClick={save} className="font-medium text-emerald-700">
          {t('expenses.save')}
        </button>
        <button onClick={onDone} className="text-neutral-500">
          {t('expenses.cancel')}
        </button>
      </div>
    </li>
  )
}
