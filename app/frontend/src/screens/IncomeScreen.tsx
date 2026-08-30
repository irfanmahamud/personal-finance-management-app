import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCreateDeduction,
  useCreateIncomeSource,
  useDeductions,
  useDeleteDeduction,
  useIncomeSources,
  usePatchIncomeSource,
  useTaxEstimate,
} from '../lib/queries'

const SOURCE_TYPES = ['salary', 'business', 'freelance', 'rental', 'remittance', 'investment', 'other'] as const
const DEDUCTION_TYPES = ['professional_tax', 'provident_fund', 'emi', 'association_fee', 'insurance'] as const

export default function IncomeScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data: sources } = useIncomeSources()
  const { data: deductions } = useDeductions()
  const patchSource = usePatchIncomeSource()
  const deleteDeduction = useDeleteDeduction()
  const hasSources = (sources ?? []).some((s) => s.active)
  const { data: tax } = useTaxEstimate(hasSources)
  const [addingSource, setAddingSource] = useState(false)
  const [addingDeduction, setAddingDeduction] = useState(false)

  return (
    <main className="mx-auto max-w-lg p-4">
      <button onClick={onBack} className="text-sm text-neutral-500">← {t('settings.title')}</button>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('income.title')}</h1>

      {/* Spec §3.2.2: the UNVERIFIED banner shows wherever a tax number does */}
      {tax && !tax.verified && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          {t('income.unverified')}
        </p>
      )}

      <section className="mt-4">
        <h2 className="text-sm font-medium text-neutral-700">{t('income.sources')}</h2>
        <ul className="mt-2 space-y-2">
          {sources?.map((s) => (
            <li key={s.id} className={`rounded-xl bg-white p-3 shadow-sm ${s.active ? '' : 'opacity-50'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-900">
                  {s.name}
                  <span className="ml-2 text-xs text-neutral-400">{t(`income.types.${s.type}`)}</span>
                </span>
                <span className="font-semibold">{formatTakaSigned(s.amount_bdt, locale)}</span>
              </div>
              <div className="mt-1 flex gap-3 text-xs text-neutral-400">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={s.taxable}
                    onChange={(e) => patchSource.mutate({ id: s.id, taxable: e.target.checked })}
                  />
                  {t('income.taxable')}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!s.active}
                    onChange={(e) => patchSource.mutate({ id: s.id, active: !e.target.checked })}
                  />
                  {t('income.inactive')}
                </label>
              </div>
            </li>
          ))}
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
          {deductions?.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
              <span className="text-neutral-700">{t(`income.deductionTypes.${d.type}`)}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium">{formatTakaSigned(d.amount, locale)}</span>
                <button onClick={() => deleteDeduction.mutate(d.id)} className="text-xs text-red-400">✕</button>
              </span>
            </li>
          ))}
        </ul>
        {addingDeduction ? (
          <AddDeductionForm onDone={() => setAddingDeduction(false)} />
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
        <section className="mt-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-neutral-700">{t('income.estimate')}</h2>
            <span className="text-xs text-neutral-400">
              {t('income.fiscalYear')} {tax.fiscal_year}
            </span>
          </div>

          {/* Gross -> net walkthrough */}
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label={t('income.grossMonthly')} value={formatTakaSigned(tax.monthly_gross, locale)} />
            <Row label={t('income.monthlyTds')} value={`− ${formatTakaSigned(tax.monthly_tds, locale)}`} tone="text-red-600" />
            <Row label={t('income.deductions')} value={`− ${formatTakaSigned(tax.monthly_deductions, locale)}`} tone="text-red-600" />
            <div className="border-t border-neutral-100 pt-1.5">
              <Row label={t('income.netTakeHome')} value={formatTakaSigned(tax.monthly_net, locale)} tone="font-bold text-emerald-700" />
            </div>
          </dl>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-neutral-500">{t('income.breakdown')}</summary>
            <dl className="mt-2 space-y-1 text-xs">
              {tax.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-neutral-500">
                    {l.label}
                    {l.detail && <span className="ml-1 text-neutral-300">{l.detail}</span>}
                  </dt>
                  <dd className={l.amount < 0 ? 'text-emerald-700' : 'text-neutral-800'}>
                    {l.amount < 0 ? '−' : ''}{formatTakaSigned(Math.abs(l.amount), locale)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    create.mutate({ name, type, amount }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl bg-white p-3 shadow-sm">
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
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">
          {t('income.save')}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-neutral-500">
          {t('income.cancel')}
        </button>
      </div>
    </form>
  )
}

function AddDeductionForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateDeduction()
  const [type, setType] = useState<string>('provident_fund')
  const [amountText, setAmountText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseTakaInput(amountText)
    if (amount == null) return
    create.mutate({ type, amount }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2 rounded-xl bg-white p-3 shadow-sm">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="flex-1 rounded border border-neutral-300 px-2 py-2 text-sm"
      >
        {DEDUCTION_TYPES.map((k) => (
          <option key={k} value={k}>{t(`income.deductionTypes.${k}`)}</option>
        ))}
      </select>
      <input
        required
        inputMode="decimal"
        placeholder="৳"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        className="w-24 rounded border border-neutral-300 px-2 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">
        ✓
      </button>
      <button type="button" onClick={onDone} className="px-2 text-sm text-neutral-400">✕</button>
    </form>
  )
}
