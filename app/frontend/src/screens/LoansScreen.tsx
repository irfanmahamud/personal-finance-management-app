import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useAddLoanPayment,
  useCreateLoan,
  useDeleteLoan,
  useLoanPayments,
  useLoans,
  useLoanSummary,
  usePatchLoan,
  type LoanGiven,
} from '../lib/queries'

const statusTone: Record<LoanGiven['status'], string> = {
  overdue: 'bg-red-50 text-red-800',
  due_soon: 'bg-amber-50 text-amber-800',
  upcoming: 'bg-neutral-100 text-neutral-500',
  no_due_date: 'bg-neutral-100 text-neutral-500',
  paid_off: 'bg-brand-50 text-brand-700',
  inactive: 'bg-neutral-100 text-neutral-400',
}

/** Loans given (not spec-numbered, explicitly requested): the mirror of
 * the Debt manager - money the household has lent to people rather than
 * owes. Interest is optional; a loan with no rate is tracked interest-free
 * and every repayment reduces principal directly. */
export default function LoansScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: loans, isLoading } = useLoans(showInactive)

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
          {t('loans.showInactive')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('loans.title')}</h1>

      <SummaryCard />

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (loans?.length ?? 0) === 0 && !adding && (
        <p className="mt-4 text-sm text-neutral-400">{t('loans.empty')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {loans?.map((loan) => (
          <LoanCard key={loan.id} loan={loan} />
        ))}
      </ul>

      {adding ? (
        <LoanForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-brand-700"
        >
          + {t('loans.add')}
        </button>
      )}
    </main>
  )
}

function SummaryCard() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data } = useLoanSummary()
  if (!data || data.active_count === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-neutral-900">{t('loans.summary')}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-neutral-400">{t('loans.totalOutstanding')}</p>
          <p className="font-semibold tabular-nums text-neutral-900">
            {formatTakaSigned(data.total_outstanding, locale)}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">{t('loans.totalRepaid')}</p>
          <p className="font-semibold tabular-nums text-neutral-900">
            {formatTakaSigned(data.total_repaid, locale)}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">{t('loans.totalInterestEarned')}</p>
          <p className="font-semibold tabular-nums text-brand-700">
            {formatTakaSigned(data.total_interest_earned, locale)}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">{t('loans.overdueCount')}</p>
          <p className={`font-semibold tabular-nums ${data.overdue_count > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
            {data.overdue_count}
          </p>
        </div>
      </div>
    </div>
  )
}

function LoanCard({ loan }: { loan: LoanGiven }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const patch = usePatchLoan()
  const del = useDeleteLoan()
  const addPayment = useAddLoanPayment()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [paymentText, setPaymentText] = useState('')
  const { data: history } = useLoanPayments(expanded ? loan.id : null)

  const paymentAmount = parseTakaInput(paymentText)
  const progressPct = loan.principal > 0
    ? Math.min(100, Math.round(((loan.principal - loan.current_balance) / loan.principal) * 100))
    : 0

  if (editing) {
    return (
      <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <LoanForm loan={loan} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-neutral-900">{loan.borrower_name}</p>
            <p className="text-xs text-neutral-400">
              {loan.interest_rate_bps != null
                ? `${(loan.interest_rate_bps / 100).toFixed(1)}% ${t('loans.interestSuffix')}`
                : t('loans.interestFree')}
              {loan.borrower_contact ? ` · ${loan.borrower_contact}` : ''}
            </p>
          </div>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
            {formatTakaSigned(loan.current_balance, locale)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${loan.paid_off ? 'bg-brand-600' : 'bg-amber-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </button>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${statusTone[loan.status]}`}>
          {t(`loans.status.${loan.status}`)}
        </span>
        {loan.due_date && <span className="text-neutral-400">{t('loans.dueDate')}: {loan.due_date}</span>}
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
          {!loan.paid_off && (
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={paymentText}
                onChange={(e) => setPaymentText(e.target.value)}
                placeholder={`${t('loans.paymentAmount')} ৳`}
                className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <button
                disabled={paymentAmount == null || addPayment.isPending}
                onClick={() => {
                  if (paymentAmount == null) return
                  addPayment.mutate(
                    { loanId: loan.id, amount: paymentAmount },
                    { onSuccess: () => setPaymentText('') },
                  )
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {t('loans.recordPayment')}
              </button>
            </div>
          )}

          <p className="text-xs font-medium text-neutral-500">{t('loans.history')}</p>
          {(history?.length ?? 0) === 0 && (
            <p className="text-xs text-neutral-400">{t('loans.noPayments')}</p>
          )}
          <ul className="space-y-1">
            {history?.map((p) => (
              <li key={p.id} className="flex justify-between text-xs text-neutral-600">
                <span>
                  {p.date}
                  {p.interest_portion > 0 &&
                    ` (${formatTakaSigned(p.principal_portion, locale)} ${t('loans.principalPortion')} + ${formatTakaSigned(p.interest_portion, locale)} ${t('loans.interest')})`}
                </span>
                <span className="tabular-nums">{formatTakaSigned(p.amount, locale)}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700">
              {t('loans.edit')}
            </button>
            {loan.active ? (
              <button
                onClick={() => patch.mutate({ id: loan.id, active: false })}
                className="text-xs text-neutral-400"
              >
                {t('loans.deactivate')}
              </button>
            ) : (
              <>
                <button
                  onClick={() => patch.mutate({ id: loan.id, active: true })}
                  className="text-xs text-neutral-400"
                >
                  {t('loans.reactivate')}
                </button>
                <button onClick={() => del.mutate(loan.id)} className="text-xs text-red-600">
                  {t('loans.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function LoanForm({ loan, onDone }: { loan?: LoanGiven; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateLoan()
  const patch = usePatchLoan()
  const mutation = loan ? patch : create

  const [borrowerName, setBorrowerName] = useState(loan?.borrower_name ?? '')
  const [borrowerContact, setBorrowerContact] = useState(loan?.borrower_contact ?? '')
  const [principalText, setPrincipalText] = useState(loan ? String(loan.principal / 100) : '')
  const [balanceText, setBalanceText] = useState(
    loan ? String(loan.current_balance / 100) : '',
  )
  const [rateText, setRateText] = useState(
    loan?.interest_rate_bps != null ? String(loan.interest_rate_bps / 100) : '',
  )
  const [startDate, setStartDate] = useState(loan?.start_date ?? '')
  const [dueDate, setDueDate] = useState(loan?.due_date ?? '')
  const [notes, setNotes] = useState(loan?.notes ?? '')

  const principal = parseTakaInput(principalText)
  const currentBalance = balanceText.trim() ? parseTakaInput(balanceText) : null
  const rate = rateText.trim() ? Number(rateText) : null
  const rateBps = rate != null && !Number.isNaN(rate) ? Math.round(rate * 100) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (principal == null) return
    const body = {
      borrower_name: borrowerName,
      borrower_contact: borrowerContact || null,
      principal,
      current_balance: currentBalance,
      interest_rate_bps: rateBps,
      start_date: startDate || null,
      due_date: dueDate || null,
      notes: notes || null,
    }
    if (loan) {
      patch.mutate({ id: loan.id, ...body }, { onSuccess: onDone })
    } else {
      create.mutate(body, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <input
        required
        value={borrowerName}
        onChange={(e) => setBorrowerName(e.target.value)}
        placeholder={t('loans.borrowerName')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        value={borrowerContact}
        onChange={(e) => setBorrowerContact(e.target.value)}
        placeholder={t('loans.borrowerContact')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={principalText}
          onChange={(e) => setPrincipalText(e.target.value)}
          placeholder={`${t('loans.principal')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        {loan && (
          <input
            inputMode="decimal"
            value={balanceText}
            onChange={(e) => setBalanceText(e.target.value)}
            placeholder={`${t('loans.currentBalance')} ৳`}
            className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        )}
      </div>
      <input
        inputMode="decimal"
        value={rateText}
        onChange={(e) => setRateText(e.target.value)}
        placeholder={t('loans.rateOptional')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <div className="w-1/2">
          <label className="text-[11px] text-neutral-400">{t('loans.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-1/2">
          <label className="text-[11px] text-neutral-400">{t('loans.dueDate')}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('loans.notes')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        rows={2}
      />
      {mutation.isError && <p className="text-xs text-red-600">{t('loans.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={mutation.isPending || principal == null}
          className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loan ? t('loans.save') : t('loans.add')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('loans.cancel')}
        </button>
      </div>
    </form>
  )
}
