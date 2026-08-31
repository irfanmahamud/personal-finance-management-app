import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCategories,
  useCreateRecurringRule,
  useDeleteRecurringRule,
  useMarkRecurringPaid,
  useMembers,
  usePatchRecurringRule,
  useRecurringRules,
  useSkipRecurring,
  type RecurringRule,
} from '../lib/queries'

const statusTone: Record<RecurringRule['status'], string> = {
  overdue: 'bg-red-50 text-red-800',
  due_today: 'bg-amber-50 text-amber-800',
  due_soon: 'bg-amber-50 text-amber-700',
  upcoming: 'bg-neutral-100 text-neutral-500',
  inactive: 'bg-neutral-100 text-neutral-400',
}

/** Recurring expenses & bills (spec §3.4.5, §3.8). Occurrences are computed
 * lazily server-side from each rule's next_due_date - this screen just
 * renders that and lets the household act on it (mark paid / skip). */
export default function RecurringScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: rules, isLoading } = useRecurringRules(showInactive)

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-neutral-500">
          ← {t('settings.title')}
        </button>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('recurring.showInactive')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('recurring.title')}</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (rules?.length ?? 0) === 0 && !adding && (
        <p className="mt-4 text-sm text-neutral-400">{t('recurring.empty')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {rules?.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </ul>

      {adding ? (
        <AddForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-emerald-700"
        >
          + {t('recurring.add')}
        </button>
      )}
    </main>
  )
}

function RuleCard({ rule }: { rule: RecurringRule }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const markPaid = useMarkRecurringPaid()
  const skip = useSkipRecurring()
  const patch = usePatchRecurringRule()
  const del = useDeleteRecurringRule()

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {rule.icon} {rule.name}
          </p>
          <p className="text-xs text-neutral-400">
            {bn ? rule.category_name_bn : rule.category_name_en}
          </p>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
          {formatTakaSigned(rule.amount, locale)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${statusTone[rule.status]}`}>
          {t(`recurring.status.${rule.status}`)}
        </span>
        <span className="text-neutral-400">
          {t('recurring.nextDue')}: {rule.next_due_date}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-neutral-400">
        {t('recurring.lastPaid')}: {rule.last_paid_date ?? t('recurring.never')}
      </p>

      {rule.active ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            disabled={markPaid.isPending}
            onClick={() => markPaid.mutate({ id: rule.id })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {t('recurring.markPaid')}
          </button>
          <button
            disabled={skip.isPending}
            onClick={() => skip.mutate(rule.id)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600"
          >
            {t('recurring.skip')}
          </button>
          <button
            onClick={() => patch.mutate({ id: rule.id, active: false })}
            className="rounded-lg px-3 py-1.5 text-xs text-neutral-400"
          >
            {t('recurring.deactivate')}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => patch.mutate({ id: rule.id, active: true })}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600"
          >
            {t('recurring.reactivate')}
          </button>
          <button
            onClick={() => {
              if (window.confirm(t('recurring.deleteConfirm'))) del.mutate(rule.id)
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-red-600"
          >
            {t('recurring.delete')}
          </button>
        </div>
      )}
    </li>
  )
}

function AddForm({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const { data: tree } = useCategories()
  const { data: members } = useMembers()
  const create = useCreateRecurringRule()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amountText, setAmountText] = useState('')
  const [dayText, setDayText] = useState('1')
  const [memberId, setMemberId] = useState('')

  const flatCategories = useMemo(() => {
    if (!tree) return []
    const out: { id: string; label: string; icon: string | null }[] = []
    for (const parent of tree) {
      out.push({ id: parent.id, label: bn ? parent.name_bn : parent.name_en, icon: parent.icon })
      for (const sub of parent.children) {
        out.push({
          id: sub.id,
          label: `${bn ? parent.name_bn : parent.name_en} / ${bn ? sub.name_bn : sub.name_en}`,
          icon: sub.icon,
        })
      }
    }
    return out
  }, [tree, bn])

  const amount = parseTakaInput(amountText)
  const day = Number(dayText)
  const dayValid = Number.isInteger(day) && day >= 1 && day <= 28

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId || amount == null || !dayValid) return
    create.mutate(
      { name, category_id: categoryId, amount, day_of_month: day, for_member_id: memberId || null },
      { onSuccess: onDone },
    )
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
    >
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('recurring.namePlaceholder')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <select
        required
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          {t('recurring.category')}
        </option>
        {flatCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.label}
          </option>
        ))}
      </select>
      {(members?.length ?? 0) > 0 && (
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">{t('entry.household')}</option>
          {members!.map((m) => (
            <option key={m.id} value={m.id}>
              {bn && m.name_bn ? m.name_bn : m.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          placeholder={`${t('recurring.amount')} ৳`}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="w-2/3 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="numeric"
          placeholder={t('recurring.dayOfMonth')}
          value={dayText}
          onChange={(e) => setDayText(e.target.value)}
          className="w-1/3 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {create.isError && <p className="text-xs text-red-600">{t('recurring.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={create.isPending || !categoryId || amount == null || !dayValid}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t('recurring.add')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-sm text-neutral-500"
        >
          {t('categories.cancel')}
        </button>
      </div>
    </form>
  )
}
