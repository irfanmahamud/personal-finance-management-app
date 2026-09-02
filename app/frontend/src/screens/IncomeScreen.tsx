import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualTip from '../components/ContextualTip'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCreateDeduction,
  useCreateIncomeSource,
  useDeductions,
  useDeleteDeduction,
  useIncomeSources,
  usePatchDeduction,
  usePatchIncomeSource,
  useSettings,
  useTaxEstimate,
  type Deduction,
  type IncomeSource,
} from '../lib/queries'

const SOURCE_TYPES = ['salary', 'business', 'freelance', 'rental', 'remittance', 'investment', 'other'] as const
const FREQUENCIES = ['monthly', 'weekly', 'biweekly', 'irregular'] as const
const DEDUCTION_TYPES = ['professional_tax', 'provident_fund', 'emi', 'association_fee', 'insurance'] as const

export default function IncomeScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data: settings } = useSettings()
  const { data: sources } = useIncomeSources()
  const { data: deductions } = useDeductions()
  const patchSource = usePatchIncomeSource()
  const deleteDeduction = useDeleteDeduction()
  const hasSources = (sources ?? []).some((s) => s.active)
  const { data: tax } = useTaxEstimate(hasSources)
  const [addingSource, setAddingSource] = useState(false)
  const [addingDeduction, setAddingDeduction] = useState(false)
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [editingDeductionId, setEditingDeductionId] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <button onClick={onBack} className="text-sm text-neutral-500">← {t('settings.title')}</button>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('income.title')}</h1>

      {/* Spec §3.2.2: the UNVERIFIED banner shows wherever a tax number does */}
      {tax && !tax.verified && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          {t('income.unverified')}
        </p>
      )}

      <section id="income-sources" className="mt-4">
        <h2 className="text-sm font-medium text-neutral-700">{t('income.sources')}</h2>
        <ul className="mt-2 space-y-2">
          {sources?.map((s) =>
            editingSourceId === s.id ? (
              <EditSourceForm key={s.id} source={s} onDone={() => setEditingSourceId(null)} />
            ) : (
              <li key={s.id} className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-sm ${s.active ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-900">
                    {s.name}
                    <span className="ml-2 text-xs text-neutral-400">{t(`income.types.${s.type}`)}</span>
                  </span>
                  <span className="font-semibold">{formatTakaSigned(s.amount_bdt, locale)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={s.taxable}
                      onChange={(e) => patchSource.mutate({ id: s.id, taxable: e.target.checked })}
                    />
                    {t('income.taxable')}
                  </label>
                  {s.taxable && (
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={s.tds_at_source}
                        onChange={(e) => patchSource.mutate({ id: s.id, tds_at_source: e.target.checked })}
                      />
                      {t('income.tdsAtSource')}
                    </label>
                  )}
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!s.active}
                      onChange={(e) => patchSource.mutate({ id: s.id, active: !e.target.checked })}
                    />
                    {t('income.inactive')}
                  </label>
                  <button onClick={() => setEditingSourceId(s.id)} className="font-medium text-brand-700">
                    {t('income.edit')}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
        {addingSource ? (
          <AddSourceForm onDone={() => setAddingSource(false)} />
        ) : (
          <button
            onClick={() => setAddingSource(true)}
            className="mt-2 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-500"
          >
            + {t('income.addSource')}
          </button>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-700">{t('income.deductionTitle')}</h2>
        <ul className="mt-2 space-y-1">
          {deductions?.map((d) =>
            editingDeductionId === d.id ? (
              <li key={d.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                <EditDeductionForm
                  deduction={d}
                  sources={sources ?? []}
                  onDone={() => setEditingDeductionId(null)}
                />
              </li>
            ) : (
              <li key={d.id} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">
                    {t(`income.deductionTypes.${d.type}`)}
                    {d.percentage_bps != null && (
                      <span className="ml-1 text-xs text-neutral-400">({(d.percentage_bps / 100).toFixed(1)}%)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{formatTakaSigned(d.amount, locale)}</span>
                    <button onClick={() => setEditingDeductionId(d.id)} className="text-xs font-medium text-brand-700">
                      {t('income.edit')}
                    </button>
                    <button onClick={() => deleteDeduction.mutate(d.id)} className="text-xs text-red-400">✕</button>
                  </span>
                </div>
                {d.employer_match_bps != null && (
                  <p className="mt-1 text-xs text-brand-700">
                    + {t('income.employerContributes')} {formatTakaSigned(d.employer_amount, locale)}
                    {' '}({(d.employer_match_bps / 100).toFixed(1)}%) {t('income.savedNotDeducted')}
                  </p>
                )}
              </li>
            ),
          )}
        </ul>
        {addingDeduction ? (
          <AddDeductionForm sources={sources ?? []} onDone={() => setAddingDeduction(false)} />
        ) : (
          <button
            onClick={() => setAddingDeduction(true)}
            className="mt-2 w-full rounded-xl border border-dashed border-neutral-300 py-2 text-sm text-neutral-500"
          >
            + {t('income.addDeduction')}
          </button>
        )}
      </section>

      {!hasSources && <p className="mt-6 text-center text-sm text-neutral-400">{t('income.noSources')}</p>}

      {tax && hasSources && (
        <>
          <div className="mt-4">
            <ContextualTip context="tax" />
          </div>
        <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-neutral-700">{t('income.estimate')}</h2>
            <span className="flex items-center gap-2 text-xs text-neutral-400">
              {t('income.fiscalYear')} {tax.fiscal_year}
              <button
                type="button"
                onClick={() => window.print()}
                className="font-medium text-brand-700 underline underline-offset-2"
              >
                {t('income.exportSummary')}
              </button>
            </span>
          </div>

          {/* Gross -> net walkthrough */}
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label={t('income.grossMonthly')} value={formatTakaSigned(tax.monthly_gross, locale)} />
            <div className="flex justify-between">
              <dt className="text-neutral-500">
                {t('income.withheld')}{' '}
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('income-sources')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="text-[11px] font-medium text-brand-700 underline underline-offset-2"
                >
                  {t('income.editWithheld')}
                </button>
              </dt>
              <dd className="text-red-600">− {formatTakaSigned(tax.monthly_withheld, locale)}</dd>
            </div>
            <Row label={t('income.deductions')} value={`− ${formatTakaSigned(tax.monthly_deductions, locale)}`} tone="text-red-600" />
            <div className="border-t border-neutral-100 pt-1.5">
              <Row label={t('income.netTakeHome')} value={formatTakaSigned(tax.monthly_net, locale)} tone="font-bold text-brand-700" />
            </div>
            {tax.monthly_set_aside > 0 && (
              <Row
                label={t('income.setAside')}
                value={formatTakaSigned(tax.monthly_set_aside, locale)}
                tone="font-semibold text-amber-700"
              />
            )}
            {tax.remaining_payable_annual < 0 && (
              <Row
                label={t('income.refundPosition')}
                value={formatTakaSigned(-tax.remaining_payable_annual, locale)}
                tone="text-sky-700"
              />
            )}
          </dl>

          {tax.provident_fund_employer_monthly > 0 && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
              {t('income.pfSavingsNote', {
                amount: formatTakaSigned(tax.monthly_deductions + tax.provident_fund_employer_monthly, locale),
              })}
            </p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-neutral-500">{t('income.breakdown')}</summary>
            <dl className="mt-2 space-y-1 text-xs">
              {tax.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-neutral-500">
                    {l.label}
                    {l.detail && <span className="ml-1 text-neutral-300">{l.detail}</span>}
                  </dt>
                  <dd className={l.amount < 0 ? 'text-brand-700' : 'text-neutral-800'}>
                    {l.amount < 0 ? '−' : ''}{formatTakaSigned(Math.abs(l.amount), locale)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>

        {/* Hidden on screen (see the "Annual summary" button above); the
         * print stylesheet shows only this container - same window.print()
         * pattern as ReportsScreen's monthly/yearly export, no PDF library.
         * A prepared summary for a human to file, not a submission (§12). */}
        <section id="printable-tax-summary" className="hidden print:block">
          <h1 className="text-lg font-bold text-neutral-900">
            {settings?.household_name} — {t('income.annualSummaryTitle', { year: tax.fiscal_year })}
          </h1>
          {!tax.verified && <p className="mt-1 text-xs">{t('income.unverified')}</p>}

          <h2 className="mt-4 text-sm font-semibold text-neutral-900">{t('income.sources')}</h2>
          <table className="mt-1 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-1">{t('income.name')}</th>
                <th className="py-1">{t('income.type')}</th>
                <th className="py-1 text-right">{t('income.monthlyAmount')}</th>
                <th className="py-1">{t('income.taxable')}</th>
                <th className="py-1">{t('income.tdsAtSource')}</th>
              </tr>
            </thead>
            <tbody>
              {(sources ?? []).filter((s) => s.active).map((s) => (
                <tr key={s.id} className="border-b border-neutral-100">
                  <td className="py-1">{s.name}</td>
                  <td className="py-1">{t(`income.types.${s.type}`)}</td>
                  <td className="py-1 text-right">{formatTakaSigned(s.amount_bdt, locale)}</td>
                  <td className="py-1">{s.taxable ? '✓' : '—'}</td>
                  <td className="py-1">{s.tds_at_source ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(deductions?.length ?? 0) > 0 && (
            <>
              <h2 className="mt-4 text-sm font-semibold text-neutral-900">{t('income.deductionTitle')}</h2>
              <table className="mt-1 w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-300 text-left">
                    <th className="py-1">{t('income.type')}</th>
                    <th className="py-1 text-right">{t('income.monthlyAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions!.map((d) => (
                    <tr key={d.id} className="border-b border-neutral-100">
                      <td className="py-1">{t(`income.deductionTypes.${d.type}`)}</td>
                      <td className="py-1 text-right">{formatTakaSigned(d.amount, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2 className="mt-4 text-sm font-semibold text-neutral-900">{t('income.breakdown')}</h2>
          <table className="mt-1 w-full border-collapse text-xs">
            <tbody>
              {tax.lines.map((l, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1">
                    {l.label}
                    {l.detail && <span className="ml-1 text-neutral-500">({l.detail})</span>}
                  </td>
                  <td className="py-1 text-right">
                    {l.amount < 0 ? '−' : ''}{formatTakaSigned(Math.abs(l.amount), locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="mt-4 w-full border-collapse text-xs">
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-1 font-semibold">{t('income.withheld')} ({t('income.annualLabel')})</td>
                <td className="py-1 text-right">{formatTakaSigned(tax.withheld_annual, locale)}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">
                  {tax.remaining_payable_annual >= 0 ? t('income.remainingPayable') : t('income.refundPosition')}
                </td>
                <td className="py-1 text-right">
                  {formatTakaSigned(Math.abs(tax.remaining_payable_annual), locale)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 text-[10px] text-neutral-500">{t('income.summaryDisclaimer')}</p>
        </section>
        </>
      )}
    </main>
  )
}

function Row({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  )
}

function AddSourceForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateIncomeSource()
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('salary')
  const [amountText, setAmountText] = useState('')
  const [tdsAtSource, setTdsAtSource] = useState(true) // typical for salary
  const [tdsText, setTdsText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    const tdsAmount = tdsText ? parseTakaInput(tdsText) : null
    create.mutate(
      { name, type, amount, tds_at_source: tdsAtSource, tds_amount_monthly: tdsAmount },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <input
        required
        placeholder={t('income.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        {SOURCE_TYPES.map((k) => (
          <option key={k} value={k}>{t(`income.types.${k}`)}</option>
        ))}
      </select>
      <input
        required
        inputMode="decimal"
        placeholder={`${t('income.monthlyAmount')} ৳`}
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          checked={tdsAtSource}
          onChange={(e) => setTdsAtSource(e.target.checked)}
        />
        {t('income.tdsAtSource')}
      </label>
      {tdsAtSource && (
        <input
          inputMode="decimal"
          placeholder={`${t('income.tdsAmount')} ৳`}
          value={tdsText}
          onChange={(e) => setTdsText(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      )}
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          {t('income.save')}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-neutral-500">
          {t('income.cancel')}
        </button>
      </div>
    </form>
  )
}

function EditSourceForm({ source, onDone }: { source: IncomeSource; onDone: () => void }) {
  const { t } = useTranslation()
  const patch = usePatchIncomeSource()
  const [name, setName] = useState(source.name)
  const [type, setType] = useState(source.type)
  const [amountText, setAmountText] = useState(String(source.amount / 100))
  const [frequency, setFrequency] = useState(source.frequency)
  const [tdsAtSource, setTdsAtSource] = useState(source.tds_at_source)
  const [tdsText, setTdsText] = useState(
    source.tds_amount_monthly != null ? String(source.tds_amount_monthly / 100) : '',
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    const tdsAmount = tdsAtSource && tdsText ? parseTakaInput(tdsText) : null
    patch.mutate(
      { id: source.id, name, type, amount, frequency, tds_at_source: tdsAtSource, tds_amount_monthly: tdsAmount },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm space-y-2">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-1/2 rounded border border-neutral-300 px-2 py-2 text-sm"
        >
          {SOURCE_TYPES.map((k) => (
            <option key={k} value={k}>{t(`income.types.${k}`)}</option>
          ))}
        </select>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="w-1/2 rounded border border-neutral-300 px-2 py-2 text-sm"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{t(`income.frequencies.${f}`)}</option>
          ))}
        </select>
      </div>
      <input
        required
        inputMode="decimal"
        placeholder={`${t('income.monthlyAmount')} ৳`}
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          checked={tdsAtSource}
          onChange={(e) => setTdsAtSource(e.target.checked)}
        />
        {t('income.tdsAtSource')}
      </label>
      {tdsAtSource && (
        <input
          inputMode="decimal"
          placeholder={`${t('income.tdsAmount')} ৳`}
          value={tdsText}
          onChange={(e) => setTdsText(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      )}
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          {t('income.save')}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-neutral-500">
          {t('income.cancel')}
        </button>
      </div>
    </form>
  )
}

function AddDeductionForm({ sources, onDone }: { sources: IncomeSource[]; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateDeduction()
  const [type, setType] = useState<string>('provident_fund')
  const [mode, setMode] = useState<'fixed' | 'percentage'>('fixed')
  const [amountText, setAmountText] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [percentText, setPercentText] = useState('')
  const [employerPercentText, setEmployerPercentText] = useState('')

  const isPf = type === 'provident_fund'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'fixed') {
      const amount = parseTakaInput(amountText)
      if (amount == null) return
      create.mutate({ type, amount }, { onSuccess: onDone })
      return
    }
    const percent = Number(percentText)
    if (!sourceId || Number.isNaN(percent) || percent <= 0) return
    const employerPercent = isPf && employerPercentText ? Number(employerPercentText) : null
    create.mutate(
      {
        type,
        income_source_id: sourceId,
        percentage_bps: Math.round(percent * 100),
        employer_match_bps: employerPercent != null && !Number.isNaN(employerPercent) ? Math.round(employerPercent * 100) : null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
      >
        {DEDUCTION_TYPES.map((k) => (
          <option key={k} value={k}>{t(`income.deductionTypes.${k}`)}</option>
        ))}
      </select>

      <div className="flex gap-1 rounded-lg bg-neutral-100 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode('fixed')}
          className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'fixed' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
        >
          {t('income.fixedAmount')}
        </button>
        <button
          type="button"
          onClick={() => setMode('percentage')}
          disabled={sources.length === 0}
          className={`flex-1 rounded-md py-1.5 font-medium disabled:opacity-40 ${mode === 'percentage' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
        >
          {t('income.percentOfIncome')}
        </button>
      </div>

      {mode === 'fixed' ? (
        <input
          required
          inputMode="decimal"
          placeholder={`৳ ${t('income.monthlyAmount')}`}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      ) : (
        <>
          <select
            required
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>{t('income.pickSource')}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              required
              inputMode="decimal"
              placeholder={`${t('income.yourContribution')} %`}
              value={percentText}
              onChange={(e) => setPercentText(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            {isPf && (
              <input
                inputMode="decimal"
                placeholder={`${t('income.employerContribution')} %`}
                value={employerPercentText}
                onChange={(e) => setEmployerPercentText(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            )}
          </div>
          {isPf && <p className="text-xs text-neutral-400">{t('income.pfHint')}</p>}
        </>
      )}

      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          {t('income.save')}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-neutral-500">
          {t('income.cancel')}
        </button>
      </div>
    </form>
  )
}

function EditDeductionForm({
  deduction,
  sources,
  onDone,
}: {
  deduction: Deduction
  sources: IncomeSource[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const patch = usePatchDeduction()
  const isPercentage = deduction.percentage_bps != null
  const [mode] = useState<'fixed' | 'percentage'>(isPercentage ? 'percentage' : 'fixed')
  const [amountText, setAmountText] = useState(isPercentage ? '' : String(deduction.amount / 100))
  const [sourceId, setSourceId] = useState(deduction.income_source_id ?? '')
  const [percentText, setPercentText] = useState(
    deduction.percentage_bps != null ? String(deduction.percentage_bps / 100) : '',
  )
  const [employerPercentText, setEmployerPercentText] = useState(
    deduction.employer_match_bps != null ? String(deduction.employer_match_bps / 100) : '',
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'fixed') {
      const amount = parseTakaInput(amountText)
      if (amount == null) return
      patch.mutate({ id: deduction.id, amount }, { onSuccess: onDone })
      return
    }
    const percent = Number(percentText)
    if (!sourceId || Number.isNaN(percent) || percent <= 0) return
    const employerPercent = employerPercentText ? Number(employerPercentText) : null
    patch.mutate(
      {
        id: deduction.id,
        income_source_id: sourceId,
        percentage_bps: Math.round(percent * 100),
        employer_match_bps: employerPercent != null && !Number.isNaN(employerPercent) ? Math.round(employerPercent * 100) : null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {mode === 'fixed' ? (
        <input
          required
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      ) : (
        <>
          <select
            required
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>{t('income.pickSource')}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              required
              inputMode="decimal"
              placeholder={`${t('income.yourContribution')} %`}
              value={percentText}
              onChange={(e) => setPercentText(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            {deduction.type === 'provident_fund' && (
              <input
                inputMode="decimal"
                placeholder={`${t('income.employerContribution')} %`}
                value={employerPercentText}
                onChange={(e) => setEmployerPercentText(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            )}
          </div>
        </>
      )}
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          {t('income.save')}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-neutral-500">
          {t('income.cancel')}
        </button>
      </div>
    </form>
  )
}
