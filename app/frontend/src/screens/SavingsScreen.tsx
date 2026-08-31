import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useAddContribution,
  useAllocationSuggestion,
  useCreateGoal,
  useGoalContributions,
  useGoals,
  usePatchGoal,
  type Goal,
} from '../lib/queries'

const GOAL_TYPES = [
  'emergency_fund',
  'child_education',
  'hajj_umrah',
  'home',
  'vehicle',
  'wedding',
  'custom',
] as const

/** Savings plans & goals (spec §3.7). Progress and the deterministic
 * "at this pace" forecast are computed server-side from contribution
 * history - this screen just renders it and lets the household act. */
export default function SavingsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: goals, isLoading } = useGoals(showInactive)

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
          {t('savings.showInactive')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('savings.title')}</h1>

      <AllocationCard />

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (goals?.length ?? 0) === 0 && !adding && (
        <p className="mt-4 text-sm text-neutral-400">{t('savings.empty')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {goals?.map((g) => (
          <GoalCard key={g.id} goal={g} />
        ))}
      </ul>

      {adding ? (
        <AddGoalForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-emerald-700"
        >
          + {t('savings.add')}
        </button>
      )}
    </main>
  )
}

function AllocationCard() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data } = useAllocationSuggestion()
  const contribute = useAddContribution()

  if (!data || data.suggestions.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-semibold text-emerald-800">{t('savings.allocation')}</p>
      <p className="mt-0.5 text-xs text-emerald-700">{t('savings.allocationHint')}</p>
      <ul className="mt-2 space-y-1.5">
        {data.suggestions.map((s) => (
          <li key={s.goal_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-neutral-800">{s.goal_name}</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums text-emerald-800">
                {formatTakaSigned(s.suggested_amount, locale)}
              </span>
              <button
                disabled={contribute.isPending}
                onClick={() => contribute.mutate({ goalId: s.goal_id, amount: s.suggested_amount })}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t('savings.confirm')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const patch = usePatchGoal()
  const contribute = useAddContribution()
  const [expanded, setExpanded] = useState(false)
  const [contribText, setContribText] = useState('')
  const { data: history } = useGoalContributions(expanded ? goal.id : null)

  const contribAmount = parseTakaInput(contribText)
  const barColor = goal.achieved ? 'bg-emerald-600' : goal.progress_pct >= 75 ? 'bg-emerald-500' : 'bg-amber-500'

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {bn && goal.name_bn ? goal.name_bn : goal.name}
            </p>
            <p className="text-xs text-neutral-400">{t(`savings.types.${goal.goal_type}`)}</p>
          </div>
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-neutral-900">
            {formatTakaSigned(goal.total_contributed, locale)} / {formatTakaSigned(goal.target_amount, locale)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className={`h-full ${barColor}`} style={{ width: `${goal.progress_pct}%` }} />
        </div>
      </button>

      <p className="mt-1.5 text-[11px] text-neutral-400">
        {goal.achieved
          ? t('savings.achieved')
          : goal.projected_completion_date
            ? `${t('savings.projectedCompletion')}: ${goal.projected_completion_date}`
            : t('savings.noForecastYet')}
      </p>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
          {!goal.achieved && (
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={contribText}
                onChange={(e) => setContribText(e.target.value)}
                placeholder={`${t('savings.contributeAmount')} ৳`}
                className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                disabled={contribAmount == null || contribute.isPending}
                onClick={() => {
                  if (contribAmount == null) return
                  contribute.mutate(
                    { goalId: goal.id, amount: contribAmount },
                    { onSuccess: () => setContribText('') },
                  )
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t('savings.contribute')}
              </button>
            </div>
          )}

          <p className="text-xs font-medium text-neutral-500">{t('savings.history')}</p>
          {(history?.length ?? 0) === 0 && (
            <p className="text-xs text-neutral-400">{t('savings.noContributions')}</p>
          )}
          <ul className="space-y-1">
            {history?.map((c) => (
              <li key={c.id} className="flex justify-between text-xs text-neutral-600">
                <span>
                  {c.date}
                  {c.notes ? ` — ${c.notes}` : ''}
                </span>
                <span className="tabular-nums">{formatTakaSigned(c.amount, locale)}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => patch.mutate({ id: goal.id, active: !goal.active })}
            className="text-xs text-neutral-400"
          >
            {goal.active ? t('savings.deactivate') : t('savings.reactivate')}
          </button>
        </div>
      )}
    </li>
  )
}

function AddGoalForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateGoal()
  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [goalType, setGoalType] = useState<(typeof GOAL_TYPES)[number]>('custom')
  const [targetText, setTargetText] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const target = parseTakaInput(targetText)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (target == null) return
    create.mutate(
      {
        name,
        name_bn: nameBn || null,
        goal_type: goalType,
        target_amount: target,
        target_date: targetDate || null,
      },
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
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('savings.name')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        value={nameBn}
        onChange={(e) => setNameBn(e.target.value)}
        placeholder={t('savings.nameBn')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <select
        value={goalType}
        onChange={(e) => setGoalType(e.target.value as typeof goalType)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        {GOAL_TYPES.map((gt) => (
          <option key={gt} value={gt}>
            {t(`savings.types.${gt}`)}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={targetText}
          onChange={(e) => setTargetText(e.target.value)}
          placeholder={`${t('savings.targetAmount')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {create.isError && <p className="text-xs text-red-600">{t('savings.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={create.isPending || target == null}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t('savings.add')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('categories.cancel')}
        </button>
      </div>
    </form>
  )
}
