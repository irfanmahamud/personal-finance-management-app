import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseTakaInput } from '../lib/money'
import {
  useCategories,
  useCreateExpense,
  useDescriptionSuggestions,
  usePaymentMethods,
  useRecent,
  type CategoryNode,
} from '../lib/queries'
import DescriptionInput from './DescriptionInput'

/**
 * The 5-second flow (spec §3.4.1): amount -> category -> saved. Three taps.
 * The category grid is ordered by the household's usage for this time of
 * day (server-side SQL ranking via /expenses/recent).
 */
export default function QuickAdd({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const bn = i18n.language === 'bn'
  const { data: tree } = useCategories()
  const { data: recentData } = useRecent()
  const { data: methods } = usePaymentMethods()
  const create = useCreateExpense()

  const [amountText, setAmountText] = useState('')
  const [full, setFull] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [methodId, setMethodId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  // Category of a picked suggestion - bumped to the front of the grid.
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null)
  const { data: suggestions } = useDescriptionSuggestions(undefined, full)

  const amount = parseTakaInput(amountText)

  // Flatten subcategories; rank by the server's time-of-day usage list.
  const subcategories = useMemo(() => {
    if (!tree) return []
    const flat: (Omit<CategoryNode, 'children'> & { parentIcon: string | null })[] = []
    for (const parent of tree) {
      for (const sub of parent.children) {
        flat.push({ ...sub, parentIcon: parent.icon })
      }
    }
    const rank = new Map((recentData?.category_ranking ?? []).map((id, i) => [id, i]))
    flat.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
    // A picked suggestion's category jumps to the front - the save tap is
    // then the very next tile under the thumb.
    if (suggestedCategoryId) {
      const i = flat.findIndex((s) => s.id === suggestedCategoryId)
      if (i > 0) flat.unshift(flat.splice(i, 1)[0])
    }
    return flat
  }, [tree, recentData, suggestedCategoryId])

  function saveWith(categoryId: string) {
    if (amount == null) return
    create.mutate(
      {
        client_uuid: crypto.randomUUID(),
        date,
        category_id: categoryId,
        amount,
        description: description || null,
        payment_method_id: methodId,
        notes: notes || null,
      },
      { onSuccess: onClose },
    )
  }

  function repeatLast() {
    const last = recentData?.last
    if (!last) return
    create.mutate(
      {
        client_uuid: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        category_id: last.category_id,
        amount: last.amount,
        description: last.description,
        payment_method_id: last.payment_method_id,
      },
      { onSuccess: onClose },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">{t('expenses.add')}</h2>
          {recentData?.last && (
            <button onClick={repeatLast} className="text-sm text-emerald-700">
              ↻ {t('expenses.repeatLast')}
            </button>
          )}
        </div>

        {/* Step 1: amount - autofocused, numeric keyboard */}
        <input
          autoFocus
          inputMode="decimal"
          placeholder="৳"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="mt-3 w-full rounded-xl border border-neutral-300 px-4 py-4 text-center text-3xl font-bold"
        />

        {/* Date: today / yesterday, one tap (spec §8 - date errors were real) */}
        <div className="mt-3 flex gap-2">
          {[
            { v: today, label: t('expenses.today') },
            { v: yesterday, label: t('expenses.yesterday') },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setDate(v)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                date === v ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full bg-neutral-200 px-3 py-1.5 text-sm text-neutral-700"
          />
        </div>

        {/* Step 2: category grid = step 3: save. One tap does both. */}
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
          {t('expenses.pickCategory')}
        </p>
        <div className={`mt-2 grid grid-cols-3 gap-2 ${amount == null ? 'pointer-events-none opacity-40' : ''}`}>
          {subcategories.slice(0, full ? undefined : 9).map((sub) => (
            <button
              key={sub.id}
              onClick={() => saveWith(sub.id)}
              disabled={create.isPending}
              className={`rounded-xl border px-2 py-3 text-center text-xs font-medium text-neutral-800 active:bg-emerald-100 ${
                sub.id === suggestedCategoryId
                  ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                  : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <span className="block text-base">{sub.parentIcon}</span>
              {bn ? sub.name_bn : sub.name_en}
            </button>
          ))}
        </div>

        {!full && (
          <button onClick={() => setFull(true)} className="mt-3 w-full text-sm text-neutral-500">
            {t('expenses.moreOptions')} ▾
          </button>
        )}

        {/* Full form (spec §3.4.3), one tap away, never in the way */}
        {full && (
          <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
            <DescriptionInput
              value={description}
              onChange={setDescription}
              onPickSuggestion={(s) => setSuggestedCategoryId(s.category_id)}
              suggestions={suggestions}
              placeholder={t('expenses.description')}
            />
            <div className="flex flex-wrap gap-2">
              {methods?.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethodId(methodId === m.id ? null : m.id)}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    methodId === m.id ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {m.icon} {bn && m.name_bn ? m.name_bn : m.name}
                </button>
              ))}
            </div>
            <textarea
              placeholder={t('expenses.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  )
}
