import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useAddDebtPayment,
  useCreateDebt,
  useDebtPayments,
  useDebts,
  useDeleteDebt,
  useEmiCalculator,
  usePatchDebt,
  usePayoffComparison,
  type Debt,
  type DebtType,
} from '../lib/queries'

const DEBT_TYPES: DebtType[] = ['bank_loan', 'personal_loan', 'family_loan', 'credit_card']

/** Debt manager (spec §3.9): loans + credit cards, an EMI calculator with
 * amortization schedule, actual-history payoff projection, and an
 * avalanche-vs-snowball comparison across all active debts. */
export default function DebtsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: debts, isLoading } = useDebts(showInactive)

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
          {t('debts.showInactive')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('debts.title')}</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (debts?.length ?? 0) === 0 && !adding && (
        <p className="mt-4 text-sm text-neutral-400">{t('debts.empty')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {debts?.map((d) => (
          <DebtCard key={d.id} debt={d} />
        ))}
      </ul>

      {adding ? (
        <DebtForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-brand-700"
        >
          + {t('debts.add')}
        </button>
      )}

      {(debts?.filter((d) => d.active && !d.paid_off).length ?? 0) > 1 && <PayoffComparisonCard />}

      <EmiCalculatorCard />
    </main>
  )
}

function DebtCard({ debt }: { debt: Debt }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const patch = usePatchDebt()
  const del = useDeleteDebt()
  const addPayment = useAddDebtPayment()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [paymentText, setPaymentText] = useState('')
  const { data: history } = useDebtPayments(expanded ? debt.id : null)

  const paymentAmount = parseTakaInput(paymentText)
  const progressPct = debt.principal > 0
    ? Math.min(100, Math.round(((debt.principal - debt.current_balance) / debt.principal) * 100))
    : 0

  if (editing) {
    return (
      <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <DebtForm debt={debt} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-neutral-900">{debt.name}</p>
            <p className="text-xs text-neutral-400">
              {t(`debts.types.${debt.debt_type}`)}
              {debt.lender ? ` · ${debt.lender}` : ''}
            </p>
          </div>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
            {formatTakaSigned(debt.current_balance, locale)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${debt.paid_off ? 'bg-brand-600' : 'bg-amber-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </button>

      <p className="mt-1.5 text-[11px] text-neutral-400">
        {debt.paid_off
          ? t('debts.paidOff')
          : debt.projected_payoff_date
            ? `${t('debts.projectedPayoff')}: ${debt.projected_payoff_date}`
            : debt.avg_monthly_payment
              ? t('debts.willNeverPayOff')
              : t('debts.noProjectionYet')}
        {debt.calculated_emi != null && ` · ${t('debts.emi')}: ${formatTakaSigned(debt.calculated_emi, locale)}`}
      </p>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
          {!debt.paid_off && (
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={paymentText}
                onChange={(e) => setPaymentText(e.target.value)}
                placeholder={`${t('debts.paymentAmount')} ৳`}
                className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                disabled={paymentAmount == null || addPayment.isPending}
                onClick={() => {
                  if (paymentAmount == null) return
                  addPayment.mutate(
                    { debtId: debt.id, amount: paymentAmount },
                    { onSuccess: () => setPaymentText('') },
                  )
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t('debts.recordPayment')}
              </button>
            </div>
          )}

          <p className="text-xs font-medium text-neutral-500">{t('debts.history')}</p>
          {(history?.length ?? 0) === 0 && (
            <p className="text-xs text-neutral-400">{t('debts.noPayments')}</p>
          )}
          <ul className="space-y-1">
            {history?.map((p) => (
              <li key={p.id} className="flex justify-between text-xs text-neutral-600">
                <span>
                  {p.date} ({formatTakaSigned(p.principal_portion, locale)} {t('debts.principalPortion')}
                  {' + '}
                  {formatTakaSigned(p.interest_portion, locale)} {t('debts.interest')})
                </span>
                <span className="tabular-nums">{formatTakaSigned(p.amount, locale)}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700">
              {t('debts.edit')}
            </button>
            {debt.active ? (
              <button
                onClick={() => patch.mutate({ id: debt.id, active: false })}
                className="text-xs text-neutral-400"
              >
                {t('debts.deactivate')}
              </button>
            ) : (
              <>
                <button
                  onClick={() => patch.mutate({ id: debt.id, active: true })}
                  className="text-xs text-neutral-400"
                >
                  {t('debts.reactivate')}
                </button>
                <button onClick={() => del.mutate(debt.id)} className="text-xs text-red-600">
                  {t('debts.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function DebtForm({ debt, onDone }: { debt?: Debt; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateDebt()
  const patch = usePatchDebt()
  const mutation = debt ? patch : create

  const [name, setName] = useState(debt?.name ?? '')
  const [lender, setLender] = useState(debt?.lender ?? '')
  const [debtType, setDebtType] = useState<DebtType>(debt?.debt_type ?? 'bank_loan')
  const [principalText, setPrincipalText] = useState(debt ? String(debt.principal / 100) : '')
  const [balanceText, setBalanceText] = useState(
    debt ? String(debt.current_balance / 100) : '',
  )
  const [rateText, setRateText] = useState(
    debt?.interest_rate_bps != null ? String(debt.interest_rate_bps / 100) : '',
  )
  const [termText, setTermText] = useState(debt?.term_months != null ? String(debt.term_months) : '')
  const [minPaymentText, setMinPaymentText] = useState(
    debt?.minimum_payment != null ? String(debt.minimum_payment / 100) : '',
  )
  const [startDate, setStartDate] = useState(debt?.start_date ?? '')
  const [notes, setNotes] = useState(debt?.notes ?? '')

  const principal = parseTakaInput(principalText)
  const currentBalance = balanceText.trim() ? parseTakaInput(balanceText) : null
  const rate = rateText.trim() ? Number(rateText) : null
  const rateBps = rate != null && !Number.isNaN(rate) ? Math.round(rate * 100) : null
  const term = termText.trim() ? Number(termText) : null
  const minPayment = minPaymentText.trim() ? parseTakaInput(minPaymentText) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (principal == null) return
    const body = {
      name,
      lender: lender || null,
      debt_type: debtType,
      principal,
      current_balance: currentBalance,
      interest_rate_bps: rateBps,
      term_months: term,
      minimum_payment: minPayment,
      start_date: startDate || null,
      notes: notes || null,
    }
    if (debt) {
      patch.mutate({ id: debt.id, ...body }, { onSuccess: onDone })
    } else {
      create.mutate(body, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <select
        value={debtType}
        onChange={(e) => setDebtType(e.target.value as DebtType)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        {DEBT_TYPES.map((dt) => (
          <option key={dt} value={dt}>
            {t(`debts.types.${dt}`)}
          </option>
        ))}
      </select>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('debts.name')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        value={lender}
        onChange={(e) => setLender(e.target.value)}
        placeholder={t('debts.lender')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={principalText}
          onChange={(e) => setPrincipalText(e.target.value)}
          placeholder={`${t('debts.principal')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="decimal"
          value={balanceText}
          onChange={(e) => setBalanceText(e.target.value)}
          placeholder={`${t('debts.currentBalance')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={rateText}
          onChange={(e) => setRateText(e.target.value)}
          placeholder={t('debts.rate')}
          className="w-1/3 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="numeric"
          value={termText}
          onChange={(e) => setTermText(e.target.value)}
          placeholder={t('debts.termMonths')}
          className="w-1/3 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="decimal"
          value={minPaymentText}
          onChange={(e) => setMinPaymentText(e.target.value)}
          placeholder={`${t('debts.minimumPayment')} ৳`}
          className="w-1/3 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-[11px] text-neutral-400">{t('debts.startDate')}</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('debts.notes')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        rows={2}
      />
      {mutation.isError && <p className="text-xs text-red-600">{t('debts.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={mutation.isPending || principal == null}
          className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {debt ? t('debts.save') : t('debts.add')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('debts.cancel')}
        </button>
      </div>
    </form>
  )
}

function EmiCalculatorCard() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const [principalText, setPrincipalText] = useState('')
  const [rateText, setRateText] = useState('')
  const [termText, setTermText] = useState('')

  const principal = principalText.trim() ? parseTakaInput(principalText) : null
  const rate = rateText.trim() ? Number(rateText) : null
  const rateBps = rate != null && !Number.isNaN(rate) ? Math.round(rate * 100) : null
  const term = termText.trim() ? Number(termText) : null

  const { data } = useEmiCalculator(principal, rateBps, term)

  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-neutral-900">{t('debts.emiCalculator')}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{t('debts.emiCalculatorHint')}</p>
      <div className="mt-2 flex gap-2">
        <input
          inputMode="decimal"
          value={principalText}
          onChange={(e) => setPrincipalText(e.target.value)}
          placeholder={`${t('debts.principal')} ৳`}
          className="w-1/3 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          inputMode="decimal"
          value={rateText}
          onChange={(e) => setRateText(e.target.value)}
          placeholder={t('debts.rate')}
          className="w-1/3 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          inputMode="numeric"
          value={termText}
          onChange={(e) => setTermText(e.target.value)}
          placeholder={t('debts.termMonths')}
          className="w-1/3 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      {data && (
        <div className="mt-2 space-y-1 border-t border-neutral-100 pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">{t('debts.emi')}</span>
            <span className="font-semibold tabular-nums">{formatTakaSigned(data.emi, locale)}</span>
          </div>
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{t('debts.totalPayment')}</span>
            <span className="tabular-nums">{formatTakaSigned(data.total_payment, locale)}</span>
          </div>
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{t('debts.totalInterest')}</span>
            <span className="tabular-nums">{formatTakaSigned(data.total_interest, locale)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function PayoffComparisonCard() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data: debts } = useDebts()
  const [extraText, setExtraText] = useState('0')
  const extra = parseTakaInput(extraText) ?? 0
  const { data } = usePayoffComparison(extra)

  const nameFor = (id: string) => debts?.find((d) => d.id === id)?.name ?? id

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-neutral-900">{t('debts.payoffComparison')}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{t('debts.payoffComparisonHint')}</p>
      <input
        inputMode="decimal"
        value={extraText}
        onChange={(e) => setExtraText(e.target.value)}
        placeholder={`${t('debts.extraMonthly')} ৳`}
        className="mt-2 w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
      />
      {data && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {(['avalanche', 'snowball'] as const).map((strategy) => {
            const s = data[strategy]
            return (
              <div key={strategy} className="rounded-lg bg-neutral-50 p-2">
                <p className="font-medium text-neutral-700">{t(`debts.${strategy}`)}</p>
                <p className="mt-1 text-neutral-500">
                  {t('debts.monthsToDebtFree')}: {s.months_to_debt_free ?? '—'}
                </p>
                <p className="text-neutral-500">
                  {t('debts.totalInterest')}: {formatTakaSigned(s.total_interest_paid, locale)}
                </p>
                <p className="mt-1 text-neutral-400">{s.order.map(nameFor).join(' → ')}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
