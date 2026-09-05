import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCategories,
  useCreateExpense,
  useCurrentBudget,
  useDescriptionSuggestions,
  useMembers,
  useRecent,
  type CategoryNode,
} from '../lib/queries'
import ConfirmationBanner from './ConfirmationBanner'
import DescriptionInput from './DescriptionInput'
import { IconCheck, IconAlert } from './icons'

/**
 * The expense entry panel, in two modes (redesign mock + 5-second rule):
 *  - instantSave (mobile sheet): tapping a category IS the save — 3 taps.
 *  - button mode (desktop rail): select category, review the live budget
 *    impact, press "Log expense".
 * One component so the two never drift.
 */
export default function ExpenseEntryPanel({
  instantSave,
  onDone,
}: {
  instantSave: boolean
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const { data: tree } = useCategories()
  const { data: recentData } = useRecent()
  const { data: members } = useMembers()
  const { data: budget } = useCurrentBudget()
  const { data: suggestions } = useDescriptionSuggestions()
  const create = useCreateExpense()

  const [amountText, setAmountText] = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null) // null = household
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(true)
  const [categorySearch, setCategorySearch] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const amount = parseTakaInput(amountText)

  // Flatten subcategories, ranked by the household's time-of-day usage;
  // a picked description suggestion bumps its category to the front.
  const subcategories = useMemo(() => {
    if (!tree) return []
    const flat: (Omit<CategoryNode, 'children'> & {
      parentIcon: string | null
      parentId: string
    })[] = []
    for (const parent of tree) {
      for (const sub of parent.children) {
        flat.push({ ...sub, parentIcon: parent.icon, parentId: parent.id })
      }
    }
    const rank = new Map((recentData?.category_ranking ?? []).map((id, i) => [id, i]))
    flat.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
    if (suggestedCategoryId) {
      const i = flat.findIndex((s) => s.id === suggestedCategoryId)
      if (i > 0) flat.unshift(flat.splice(i, 1)[0])
    }
    return flat
  }, [tree, recentData, suggestedCategoryId])

  const filtered = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return subcategories
    return subcategories.filter(
      (s) => s.name_en.toLowerCase().includes(q) || s.name_bn.includes(categorySearch.trim()),
    )
  }, [subcategories, categorySearch])

  const visible = categorySearch.trim()
    ? filtered
    : showAll
      ? subcategories
      : subcategories.slice(0, instantSave ? 9 : 6)

  const selectedSub = selectedCat ? subcategories.find((s) => s.id === selectedCat) : null

  function flashSaved(status: 'saved' | 'queued', thenClose: boolean) {
    setSavedMessage(status === 'queued' ? t('offline.queuedSaved') : t('entry.saved'))
    setTimeout(() => setSavedMessage(null), 2500)
    // Give the user a beat to actually see the confirmation before the
    // quick-add sheet (instantSave) closes out from under it.
    if (thenClose) setTimeout(() => onDone?.(), 900)
  }

  function save(categoryId: string) {
    if (amount == null) return
    create.mutate(
      {
        client_uuid: crypto.randomUUID(),
        date,
        category_id: categoryId,
        amount,
        description: description || null,
        for_member_id: memberId,
      },
      {
        onSuccess: (result) => {
          setAmountText('')
          setDescription('')
          setSelectedCat(null)
          setCategoryOpen(true)
          setCategorySearch('')
          flashSaved(result.status, instantSave)
        },
      },
    )
  }

  function onCategoryTap(id: string) {
    if (instantSave) save(id)
    else {
      setSelectedCat(id)
      setCategoryOpen(false)
    }
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
        for_member_id: last.for_member_id,
      },
      { onSuccess: (result) => flashSaved(result.status, true) },
    )
  }

  // Budget impact: the line for the selected sub's PARENT category.
  const impact = useMemo(() => {
    if (!selectedCat || !budget) return null
    const sub = subcategories.find((s) => s.id === selectedCat)
    if (!sub) return null
    const line = budget.lines.find((l) => l.category_id === sub.parentId)
    if (!line) return { noLimit: true as const, name: bn ? sub.name_bn : sub.name_en }
    const limit = line.amount + line.rolled_over_amount
    const typed = amount ?? 0
    const beforePct = limit > 0 ? Math.min(100, (line.spent / limit) * 100) : 0
    const afterPct = limit > 0 ? Math.min(100, ((line.spent + typed) / limit) * 100) : 0
    const remaining = limit - line.spent - typed
    return {
      noLimit: false as const,
      name: bn ? line.category_name_bn : line.category_name_en,
      icon: line.icon,
      spent: line.spent,
      limit,
      beforePct,
      afterPct,
      remaining,
    }
  }, [selectedCat, budget, subcategories, amount, bn])

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  const fillColor = (pct: number) =>
    pct >= 95 ? 'bg-red-600' : pct >= 75 ? 'bg-amber-500' : 'bg-brand-600'
  const noticeTone = (pct: number) =>
    pct >= 95
      ? 'bg-red-50 text-red-800'
      : pct >= 75
        ? 'bg-amber-50 text-amber-800'
        : 'bg-brand-50 text-brand-800'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-neutral-900">{t('entry.title')}</h2>
        {recentData?.last && (
          <button onClick={repeatLast} className="text-xs font-medium text-brand-700">
            ↻ {t('expenses.repeatLast')}
          </button>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>{t('entry.amount')}</SectionLabel>
        <div className="flex items-baseline gap-2 rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2">
          <span className="text-xl font-semibold text-neutral-400">৳</span>
          <input
            autoFocus={instantSave}
            inputMode="decimal"
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="w-full bg-transparent text-2xl font-bold tabular-nums text-neutral-900 outline-none"
          />
        </div>
      </div>

      {savedMessage && <ConfirmationBanner message={savedMessage} />}

      {/* Note with suggestions — kept ABOVE the category grid so a tap on
       * a category (which saves instantly in instantSave mode) can never
       * beat the user to it before they've had a chance to type one. */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>
          {t('entry.note')}{' '}
          <span className="font-normal normal-case">{t('entry.optional')}</span>
        </SectionLabel>
        <DescriptionInput
          value={description}
          onChange={setDescription}
          onPickSuggestion={(s) => setSuggestedCategoryId(s.category_id)}
          suggestions={suggestions}
          placeholder={t('expenses.description')}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {/* Category — collapsible, with search */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <SectionLabel>{t('entry.category')}</SectionLabel>
          {!instantSave && selectedSub && !categoryOpen ? (
            <button
              onClick={() => setCategoryOpen(true)}
              className="text-xs font-medium text-brand-700"
            >
              {t('entry.change')}
            </button>
          ) : (
            <button
              onClick={() => setCategoryOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-neutral-500"
            >
              {categoryOpen ? t('entry.collapse') : t('entry.open')}
              <span className="text-base leading-none">{categoryOpen ? '▴' : '▾'}</span>
            </button>
          )}
        </div>

        {!categoryOpen && selectedSub ? (
          <button
            onClick={() => setCategoryOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-brand-600 bg-brand-50 px-3 py-2 text-left text-xs font-semibold text-brand-700"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base">
              {selectedSub.parentIcon}
            </span>
            {bn ? selectedSub.name_bn : selectedSub.name_en}
          </button>
        ) : categoryOpen ? (
          <>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder={t('entry.searchCategory')}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800 outline-none focus:border-brand-500"
            />
            <div
              className={`grid grid-cols-3 gap-1.5 ${
                instantSave && amount == null ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              {visible.map((sub) => {
                const selected = !instantSave && selectedCat === sub.id
                const highlighted = sub.id === suggestedCategoryId
                return (
                  <button
                    key={sub.id}
                    onClick={() => onCategoryTap(sub.id)}
                    disabled={create.isPending}
                    className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center text-xs active:bg-brand-100 ${
                      selected
                        ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700'
                        : highlighted
                          ? 'border-brand-400 bg-brand-50 font-medium text-neutral-800 ring-1 ring-brand-300'
                          : 'border-neutral-200 bg-white font-medium text-neutral-800'
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm">
                      {sub.parentIcon}
                    </span>
                    {bn ? sub.name_bn : sub.name_en}
                  </button>
                )
              })}
              {visible.length === 0 && (
                <p className="col-span-3 py-2 text-center text-xs text-neutral-400">
                  {t('entry.noCategoryMatch')}
                </p>
              )}
            </div>
            {!categorySearch.trim() && !showAll && subcategories.length > visible.length && (
              <button onClick={() => setShowAll(true)} className="text-xs text-neutral-500">
                {t('entry.moreCategories')} ▾
              </button>
            )}
          </>
        ) : null}
      </div>

      {/* For — household / member chips */}
      {(members?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>{t('entry.for')}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={memberId === null} onClick={() => setMemberId(null)}>
              {t('entry.household')}
            </Chip>
            {members!.map((m) => (
              <Chip
                key={m.id}
                selected={memberId === m.id}
                onClick={() => setMemberId(m.id)}
              >
                {bn && m.name_bn ? m.name_bn : m.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>{t('entry.date')}</SectionLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip selected={date === today} onClick={() => setDate(today)}>
            {t('expenses.today')}
          </Chip>
          <Chip selected={date === yesterday} onClick={() => setDate(yesterday)}>
            {t('expenses.yesterday')}
          </Chip>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700"
          />
        </div>
      </div>

      {/* Budget impact (desktop / button mode) */}
      {!instantSave && impact && (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <SectionLabel>{t('entry.budgetImpact')}</SectionLabel>
          {impact.noLimit ? (
            <p className="mt-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
              <IconCheck /> {t('entry.noLimitHint')}
            </p>
          ) : (
            <>
              <div className="mt-2 flex justify-between text-xs text-neutral-500">
                <span>{t('entry.spentSoFar')}</span>
                <span className="font-semibold tabular-nums text-neutral-900">
                  {formatTakaSigned(impact.spent, locale)}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-neutral-500">
                <span>{t('entry.monthlyLimit')}</span>
                <span className="font-semibold tabular-nums text-neutral-900">
                  {formatTakaSigned(impact.limit, locale)}
                </span>
              </div>
              <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${fillColor(impact.beforePct)}`}
                  style={{ width: `${impact.beforePct}%` }}
                />
                {/* Projected segment for the amount being typed */}
                <div
                  className={`absolute inset-y-0 rounded-full opacity-50 ${fillColor(impact.afterPct)}`}
                  style={{
                    left: `${impact.beforePct}%`,
                    width: `${Math.max(0, impact.afterPct - impact.beforePct)}%`,
                    backgroundImage:
                      'repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,0.6) 4px 8px)',
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>{t('entry.pctUsed', { pct: Math.round(impact.beforePct) })}</span>
                <span>{t('entry.pctAfter', { pct: Math.round(impact.afterPct) })}</span>
              </div>
              <p
                className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${noticeTone(impact.afterPct)}`}
              >
                {impact.afterPct >= 75 ? <IconAlert /> : <IconCheck />}
                {impact.remaining < 0
                  ? t('entry.overAfter', {
                      amount: formatTakaSigned(-impact.remaining, locale),
                      category: impact.name,
                    })
                  : t('entry.leftAfter', {
                      amount: formatTakaSigned(impact.remaining, locale),
                      category: impact.name,
                    })}
              </p>
            </>
          )}
        </div>
      )}

      {/* Log button (desktop / button mode only - mobile saves on category tap) */}
      {!instantSave && (
        <button
          disabled={amount == null || selectedCat == null || create.isPending}
          onClick={() => selectedCat && save(selectedCat)}
          className="min-h-11 w-full rounded-xl bg-brand-600 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {t('entry.log')}
        </button>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </span>
  )
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-neutral-200 bg-white text-neutral-500'
      }`}
    >
      {children}
    </button>
  )
}
