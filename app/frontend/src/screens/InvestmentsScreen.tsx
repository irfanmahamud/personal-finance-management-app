import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualTip from '../components/ContextualTip'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCreateInvestment,
  useDeleteInvestment,
  useInvestments,
  usePatchInvestment,
  usePortfolio,
  type Investment,
  type InstrumentType,
} from '../lib/queries'

const INSTRUMENT_TYPES: InstrumentType[] = [
  'dps',
  'fdr',
  'sanchayapatra',
  'pension',
  'provident_fund',
  'business',
  'mutual_fund_gold',
]

const maturityTone: Record<Investment['maturity_status'], string> = {
  overdue: 'bg-red-50 text-red-800',
  renewal_due: 'bg-amber-50 text-amber-800',
  maturity_soon: 'bg-amber-50 text-amber-700',
  upcoming: 'bg-neutral-100 text-neutral-500',
  none: 'bg-neutral-100 text-neutral-400',
}

/** Investment tracking (spec §3.7A): DPS/FDR/Sanchayapatra/pension/PF/
 * business/mutual-fund-gold on one flexible schema, with a deterministic
 * maturity-value estimate, portfolio overview, and automatic tax-rebate
 * linkage (a rebate_eligible investment feeds /tax/estimate server-side,
 * no separate entry). DSE stocks are Phase 4. */
export default function InvestmentsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: investments, isLoading } = useInvestments(showInactive)

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
          {t('investments.showInactive')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('investments.title')}</h1>

      <div className="mt-3">
        <ContextualTip context="investments" />
      </div>

      <PortfolioCard />

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (investments?.length ?? 0) === 0 && !adding && (
        <p className="mt-4 text-sm text-neutral-400">{t('investments.empty')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {investments?.map((inv) => (
          <InvestmentCard key={inv.id} investment={inv} />
        ))}
      </ul>

      {adding ? (
        <InvestmentForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-brand-700"
        >
          + {t('investments.add')}
        </button>
      )}
    </main>
  )
}

function PortfolioCard() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data } = usePortfolio()
  if (!data || data.by_type.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-neutral-900">{t('investments.portfolio')}</p>
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-neutral-500">{t('investments.totalInvested')}</span>
        <span className="font-semibold tabular-nums text-neutral-900">
          {formatTakaSigned(data.total_invested, locale)}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-sm">
        <span className="text-neutral-500">{t('investments.totalCurrentValue')}</span>
        <span className="font-semibold tabular-nums text-brand-700">
          {formatTakaSigned(data.total_current_value, locale)}
        </span>
      </div>

      <ul className="mt-2 space-y-1 border-t border-neutral-100 pt-2">
        {data.by_type.map((row) => (
          <li key={row.instrument_type} className="flex justify-between text-xs text-neutral-500">
            <span>
              {t(`investments.types.${row.instrument_type}`)} ({row.count})
            </span>
            <span className="tabular-nums">{formatTakaSigned(row.current_value, locale)}</span>
          </li>
        ))}
      </ul>

      {data.next_maturities.length > 0 && (
        <>
          <p className="mt-2 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-500">
            {t('investments.nextMaturities')}
          </p>
          <ul className="mt-1 space-y-1">
            {data.next_maturities.map((m) => (
              <li key={m.id} className="flex justify-between text-xs text-neutral-500">
                <span>{m.name}</span>
                <span>{m.maturity_date}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function InvestmentCard({ investment }: { investment: Investment }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const patch = usePatchInvestment()
  const del = useDeleteInvestment()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <InvestmentForm investment={investment} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-neutral-900">{investment.name}</p>
          <p className="text-xs text-neutral-400">{t(`investments.types.${investment.instrument_type}`)}</p>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
          {formatTakaSigned(investment.effective_value, locale)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${maturityTone[investment.maturity_status]}`}>
          {t(`investments.maturityStatus.${investment.maturity_status}`)}
        </span>
        {investment.maturity_date && <span className="text-neutral-400">{investment.maturity_date}</span>}
        {investment.rebate_eligible && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
            {t('investments.rebateEligible')}
          </span>
        )}
      </div>

      {investment.projected_maturity_value != null && (
        <p className="mt-1 text-[11px] text-neutral-400">
          {t('investments.projectedMaturity')}: {formatTakaSigned(investment.projected_maturity_value, locale)}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700">
          {t('investments.edit')}
        </button>
        {investment.active ? (
          <button
            onClick={() => patch.mutate({ id: investment.id, active: false })}
            className="text-xs text-neutral-400"
          >
            {t('investments.deactivate')}
          </button>
        ) : (
          <>
            <button
              onClick={() => patch.mutate({ id: investment.id, active: true })}
              className="text-xs text-neutral-400"
            >
              {t('investments.reactivate')}
            </button>
            <button onClick={() => del.mutate(investment.id)} className="text-xs text-red-600">
              {t('recurring.delete')}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function InvestmentForm({
  investment,
  onDone,
}: {
  investment?: Investment
  onDone: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateInvestment()
  const patch = usePatchInvestment()
  const mutation = investment ? patch : create

  const [instrumentType, setInstrumentType] = useState<InstrumentType>(
    investment?.instrument_type ?? 'dps',
  )
  const [name, setName] = useState(investment?.name ?? '')
  const [amountText, setAmountText] = useState(
    investment ? String(investment.amount / 100) : '',
  )
  const [rateText, setRateText] = useState(
    investment?.rate_bps != null ? String(investment.rate_bps / 100) : '',
  )
  const [tenureText, setTenureText] = useState(
    investment?.tenure_months != null ? String(investment.tenure_months) : '',
  )
  const [startDate, setStartDate] = useState(investment?.start_date ?? '')
  const [maturityDate, setMaturityDate] = useState(investment?.maturity_date ?? '')
  const [autoRenewal, setAutoRenewal] = useState(investment?.auto_renewal ?? false)
  const [currentValueText, setCurrentValueText] = useState(
    investment?.current_value != null ? String(investment.current_value / 100) : '',
  )
  const [rebateEligible, setRebateEligible] = useState(investment?.rebate_eligible ?? false)
  const [zakatable, setZakatable] = useState(investment?.zakatable ?? false)
  const [notes, setNotes] = useState(investment?.notes ?? '')

  const amount = parseTakaInput(amountText)
  const rate = rateText.trim() ? Number(rateText) : null
  const rateBps = rate != null && !Number.isNaN(rate) ? Math.round(rate * 100) : null
  const tenure = tenureText.trim() ? Number(tenureText) : null
  const currentValue = currentValueText.trim() ? parseTakaInput(currentValueText) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (amount == null) return
    const body = {
      instrument_type: instrumentType,
      name,
      amount,
      rate_bps: rateBps,
      tenure_months: tenure,
      start_date: startDate || null,
      maturity_date: maturityDate || null,
      auto_renewal: autoRenewal,
      current_value: currentValue,
      rebate_eligible: rebateEligible,
      zakatable,
      notes: notes || null,
    }
    if (investment) {
      patch.mutate({ id: investment.id, ...body }, { onSuccess: onDone })
    } else {
      create.mutate(body, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <select
        value={instrumentType}
        onChange={(e) => setInstrumentType(e.target.value as InstrumentType)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        {INSTRUMENT_TYPES.map((it) => (
          <option key={it} value={it}>
            {t(`investments.types.${it}`)}
          </option>
        ))}
      </select>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('investments.name')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          placeholder={`${t('investments.amount')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="decimal"
          value={rateText}
          onChange={(e) => setRateText(e.target.value)}
          placeholder={t('investments.rate')}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          value={tenureText}
          onChange={(e) => setTenureText(e.target.value)}
          placeholder={t('investments.tenureMonths')}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="decimal"
          value={currentValueText}
          onChange={(e) => setCurrentValueText(e.target.value)}
          placeholder={`${t('investments.currentValue')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <div className="w-1/2">
          <label className="text-[11px] text-neutral-400">{t('investments.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-1/2">
          <label className="text-[11px] text-neutral-400">{t('investments.maturityDate')}</label>
          <input
            type="date"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('investments.notes')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        rows={2}
      />
      <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={autoRenewal} onChange={(e) => setAutoRenewal(e.target.checked)} />
          {t('investments.autoRenewal')}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={rebateEligible}
            onChange={(e) => setRebateEligible(e.target.checked)}
          />
          {t('investments.rebateEligible')}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={zakatable} onChange={(e) => setZakatable(e.target.checked)} />
          {t('investments.zakatable')}
        </label>
      </div>
      {mutation.isError && <p className="text-xs text-red-600">{t('investments.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={mutation.isPending || amount == null}
          className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {investment ? t('investments.save') : t('investments.add')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('investments.cancel')}
        </button>
      </div>
    </form>
  )
}
