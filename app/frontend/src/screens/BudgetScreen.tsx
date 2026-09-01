import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualTip from '../components/ContextualTip'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import { tipsForContext } from '../lib/tips'
import {
  useAddBudgetLine,
  useBudgetForPeriod,
  useBudgetHistory,
  useCategories,
  useCreateBudget,
  useCreateCategory,
  useCurrentBudget,
  usePatchBudgetLine,
  type BudgetLine,
} from '../lib/queries'
import { ApiError } from '../lib/api-client'

const statusColor: Record<BudgetLine['status'], string> = {
  ok: 'bg-brand-500',
  warn75: 'bg-amber-500',
  warn95: 'bg-red-500',
}

function nextPeriodStart(today = new Date()): string {
  const y = today.getFullYear()
  const m = today.getMonth() // 0-indexed; +1 below moves to next month
  const next = new Date(y, m + 1, 1)
  return next.toISOString().slice(0, 10)
}

type Screen = 'current' | 'planNext' | 'history'

export default function BudgetScreen() {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<Screen>('current')
  const { data: budget, isLoading, error } = useCurrentBudget()
  const nextPeriod = nextPeriodStart()
  const nextPeriodKey = nextPeriod.slice(0, 7)
  const { data: nextBudget } = useBudgetForPeriod(nextPeriodKey)

  const noBudget = error instanceof ApiError && error.status === 404

  if (screen === 'history') {
    return <BudgetHistory onBack={() => setScreen('current')} />
  }
  if (screen === 'planNext') {
    return (
      <CreateBudget
        periodStart={nextPeriod}
        title={t('budget.nextPeriodTitle')}
        onBack={() => setScreen('current')}
        onDone={() => setScreen('current')}
      />
    )
  }

  if (isLoading) {
    return <main className="p-4 text-sm text-neutral-400">{t('common.loading')}</main>
  }

  const footer = (
    <div className="mx-auto mt-6 flex max-w-lg flex-wrap gap-3 text-xs font-medium lg:mx-0 lg:max-w-2xl">
      {!nextBudget && (
        <button onClick={() => setScreen('planNext')} className="text-brand-700">
          {t('budget.planNext')} →
        </button>
      )}
      <button onClick={() => setScreen('history')} className="text-neutral-500">
        {t('budget.viewHistory')} →
      </button>
    </div>
  )

  if (noBudget || !budget) {
    return (
      <>
        <CreateBudget />
        {footer}
      </>
    )
  }
  return (
    <>
      <BudgetView />
      {footer}
    </>
  )
}

function CreateBudget({
  periodStart,
  title,
  onBack,
  onDone,
}: {
  periodStart?: string
  title?: string
  onBack?: () => void
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const create = useCreateBudget()
  const { data: tree } = useCategories()
  const [method, setMethod] = useState<'template' | '50_30_20' | 'zero_based'>('template')
  const [template, setTemplate] = useState('young_family')
  const [totalText, setTotalText] = useState('')
  const total = parseTakaInput(totalText)

  const [assignableText, setAssignableText] = useState('')
  const assignable = parseTakaInput(assignableText)
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({})
  const topLevel = tree ?? []
  const assignedTotal = topLevel.reduce(
    (sum, c) => sum + (parseTakaInput(lineAmounts[c.id] ?? '') ?? 0),
    0,
  )
  const unassigned = assignable != null ? assignable - assignedTotal : null

  const canSubmit =
    method === 'zero_based' ? assignable != null : total != null

  function submit() {
    if (method === 'zero_based') {
      if (assignable == null) return
      const lines = topLevel
        .map((c) => ({ category_id: c.id, amount: parseTakaInput(lineAmounts[c.id] ?? '') ?? 0 }))
        .filter((l) => l.amount > 0)
      create.mutate(
        { lines, assignable_amount: assignable, period_start: periodStart },
        { onSuccess: onDone },
      )
    } else {
      if (total == null) return
      create.mutate(
        { template: method === '50_30_20' ? '50_30_20' : template, total_amount: total, period_start: periodStart },
        { onSuccess: onDone },
      )
    }
  }

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      {onBack && (
        <button onClick={onBack} className="mb-2 text-xs font-medium text-neutral-500">
          ← {t('budget.backToCurrent')}
        </button>
      )}
      <h1 className="text-xl font-bold text-neutral-900">{title ?? t('budget.title')}</h1>
      <p className="mt-2 text-sm text-neutral-500">{t('budget.noBudget')}</p>

      <h2 className="mt-6 text-sm font-medium text-neutral-700">{t('budget.method')}</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(['template', '50_30_20', 'zero_based'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-xl px-2 py-2.5 text-xs font-medium ${
              method === m ? 'border border-brand-600 bg-brand-600 text-white' : 'bg-white text-neutral-700 shadow-sm'
            }`}
          >
            {t(`budget.methods.${m}`)}
          </button>
        ))}
      </div>

      {method === 'template' && (
        <>
          <h2 className="mt-4 text-sm font-medium text-neutral-700">{t('budget.pickTemplate')}</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['young_professional', 'young_family', 'extended_family'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTemplate(key)}
                className={`rounded-xl px-3 py-3 text-sm ${
                  template === key ? 'border border-brand-600 bg-brand-600 text-white' : 'bg-white text-neutral-700 shadow-sm'
                }`}
              >
                {t(`budget.templates.${key}`)}
              </button>
            ))}
          </div>
          <input
            inputMode="decimal"
            placeholder={`${t('budget.totalAmount')} ৳`}
            value={totalText}
            onChange={(e) => setTotalText(e.target.value)}
            className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg"
          />
        </>
      )}

      {method === '50_30_20' && (
        <>
          <p className="mt-3 text-xs text-neutral-500">{t('budget.fiftyThirtyTwentyHint')}</p>
          <input
            inputMode="decimal"
            placeholder={`${t('budget.totalAmount')} ৳`}
            value={totalText}
            onChange={(e) => setTotalText(e.target.value)}
            className="mt-3 w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg"
          />
        </>
      )}

      {method === 'zero_based' && (
        <>
          <p className="mt-3 text-xs text-neutral-500">{t('budget.zeroBasedHint')}</p>
          <input
            inputMode="decimal"
            placeholder={`${t('budget.assignableAmount')} ৳`}
            value={assignableText}
            onChange={(e) => setAssignableText(e.target.value)}
            className="mt-3 w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg"
          />
          {assignable != null && (
            <p className={`mt-2 text-sm font-semibold ${unassigned != null && unassigned < 0 ? 'text-red-600' : 'text-brand-700'}`}>
              {t('budget.unassigned')}: {formatTakaSigned(unassigned ?? 0, locale)}
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {topLevel.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-neutral-700">
                  {c.icon} {bn ? c.name_bn : c.name_en}
                </span>
                <input
                  inputMode="decimal"
                  value={lineAmounts[c.id] ?? ''}
                  onChange={(e) => setLineAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="৳0"
                  className="w-24 rounded border border-neutral-300 px-2 py-1.5 text-right text-sm"
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {create.isError && <p className="mt-2 text-sm text-red-600">{t('budget.createFailed')}</p>}
      <button
        disabled={!canSubmit || create.isPending}
        onClick={submit}
        className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        {t('budget.create')}
      </button>
    </main>
  )
}

function BudgetHistory({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data: history, isLoading } = useBudgetHistory()

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <button onClick={onBack} className="mb-2 text-xs font-medium text-neutral-500">
        ← {t('budget.backToCurrent')}
      </button>
      <h1 className="text-xl font-bold text-neutral-900">{t('budget.history')}</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (history?.length ?? 0) === 0 && (
        <p className="mt-4 text-sm text-neutral-400">{t('budget.noHistory')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {history?.map((b) => (
          <li key={b.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-900">
                {new Date(b.period_start).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="text-neutral-500">
                {formatTakaSigned(b.total_spent, locale)} / {formatTakaSigned(b.total_amount, locale)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}

function BudgetView() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const { data: budget } = useCurrentBudget()
  const { data: tree } = useCategories()
  const patchLine = usePatchBudgetLine()
  const addLine = useAddBudgetLine()
  const [editing, setEditing] = useState<string | null>(null)
  const [amountText, setAmountText] = useState('')
  const [adding, setAdding] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newAmountText, setNewAmountText] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  if (!budget) return null
  const remaining = budget.total_amount - budget.total_spent

  const usedCategoryIds = new Set(budget.lines.map((l) => l.category_id))
  const availableCategories = (tree ?? []).filter((c) => !c.archived && !usedCategoryIds.has(c.id))
  const newAmount = parseTakaInput(newAmountText)
  const categoryTipContext = budget.lines
    .map((l) => `category:${l.category_name_en}`)
    .find((ctx) => tipsForContext(ctx).length > 0)

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-neutral-900">{t('budget.title')}</h1>
        <span className="text-xs text-neutral-400">{budget.fiscal_year}</span>
      </div>

      <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-500">
          {t('budget.spent')}{' '}
          <span className="font-semibold text-neutral-900">
            {formatTakaSigned(budget.total_spent, locale)}
          </span>{' '}
          {t('budget.of')} {formatTakaSigned(budget.total_amount, locale)}
        </p>
        <p className="text-sm text-neutral-500">
          {t('budget.remaining')}{' '}
          <span className={`font-semibold ${remaining < 0 ? 'text-red-600' : 'text-brand-700'}`}>
            {formatTakaSigned(remaining, locale)}
          </span>
        </p>
        {budget.unassigned_amount != null && (
          <p className="text-sm text-neutral-500">
            {t('budget.unassigned')}{' '}
            <span className={`font-semibold ${budget.unassigned_amount < 0 ? 'text-red-600' : budget.unassigned_amount > 0 ? 'text-amber-600' : 'text-brand-700'}`}>
              {formatTakaSigned(budget.unassigned_amount, locale)}
            </span>
          </p>
        )}
      </div>

      {categoryTipContext && (
        <div className="mt-3">
          <ContextualTip context={categoryTipContext} />
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {budget.lines.map((line) => {
          const limit = line.amount + line.rolled_over_amount
          const pct = limit > 0 ? Math.min(100, Math.round((line.spent / limit) * 100)) : 0
          return (
            <li key={line.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-900">
                  {line.icon} {bn ? line.category_name_bn : line.category_name_en}
                </span>
                {editing === line.id ? (
                  <span className="flex items-center gap-2">
                    <input
                      inputMode="decimal"
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value)}
                      className="w-24 rounded border border-neutral-300 px-2 py-0.5 text-right text-sm"
                      autoFocus
                    />
                    <button
                      className="text-xs font-medium text-brand-700"
                      onClick={() => {
                        const amount = parseTakaInput(amountText)
                        if (amount != null) {
                          patchLine.mutate({ budgetId: budget.id, lineId: line.id, amount })
                        }
                        setEditing(null)
                      }}
                    >
                      ✓
                    </button>
                  </span>
                ) : (
                  <button
                    className="text-neutral-600"
                    onClick={() => {
                      setEditing(line.id)
                      setAmountText(String(line.amount / 100))
                    }}
                  >
                    {formatTakaSigned(line.spent, locale)} / {formatTakaSigned(limit, locale)}
                  </button>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full ${statusColor[line.status]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <label className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  checked={line.rollover_enabled}
                  onChange={(e) =>
                    patchLine.mutate({
                      budgetId: budget.id,
                      lineId: line.id,
                      rollover_enabled: e.target.checked,
                    })
                  }
                />
                {t('budget.rollover')}
                {line.rolled_over_amount > 0 && ` (+${formatTakaSigned(line.rolled_over_amount, locale)})`}
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-4">
        {adding ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            {availableCategories.length === 0 ? (
              <p className="text-sm text-neutral-400">{t('budget.allCategoriesAdded')}</p>
            ) : (
              <>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    {t('budget.addCategory')}
                  </option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {bn ? c.name_bn : c.name_en}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCreatingCategory(true)}
                  className="mt-1.5 text-xs font-medium text-brand-700"
                >
                  + {t('categories.add')}
                </button>
                <input
                  inputMode="decimal"
                  placeholder={`${t('budget.addCategoryAmount')} ৳`}
                  value={newAmountText}
                  onChange={(e) => setNewAmountText(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                {addLine.isError && (
                  <p className="mt-1 text-xs text-red-600">{t('budget.addFailed')}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={!newCategoryId || newAmount == null || addLine.isPending}
                    onClick={() =>
                      addLine.mutate(
                        { budgetId: budget.id, category_id: newCategoryId, amount: newAmount! },
                        {
                          onSuccess: () => {
                            setAdding(false)
                            setNewCategoryId('')
                            setNewAmountText('')
                          },
                        },
                      )
                    }
                    className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {t('budget.create')}
                  </button>
                  <button
                    onClick={() => setAdding(false)}
                    className="rounded-lg px-3 py-2 text-sm text-neutral-500"
                  >
                    {t('categories.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-brand-700"
          >
            + {t('budget.addCategory')}
          </button>
        )}
      </div>

      {creatingCategory && (
        <NewCategoryModal
          onClose={() => setCreatingCategory(false)}
          onCreated={(id) => {
            setNewCategoryId(id)
            setCreatingCategory(false)
          }}
        />
      )}
    </main>
  )
}

function NewCategoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const create = useCreateCategory()
  const [nameEn, setNameEn] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [icon, setIcon] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate(
      { parent_id: null, name_en: nameEn, name_bn: nameBn, icon: icon || null },
      { onSuccess: (category) => onCreated(category.id) },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-2 rounded-xl bg-white p-4 shadow-lg"
      >
        <h2 className="text-sm font-bold text-neutral-900">{t('categories.add')}</h2>
        <input
          required
          autoFocus
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder={t('categories.nameEn')}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          required
          value={nameBn}
          onChange={(e) => setNameBn(e.target.value)}
          placeholder={t('categories.nameBn')}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder={t('categories.icon')}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        {create.isError && <p className="text-xs text-red-600">{t('budget.addFailed')}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={create.isPending}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t('categories.save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-neutral-500"
          >
            {t('categories.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
