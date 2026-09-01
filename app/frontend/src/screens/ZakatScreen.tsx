import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import { usePatchZakatConfig, useZakatConfig, useZakatEstimate } from '../lib/queries'

/** Zakat calculator (spec §5.3). Zakatable wealth = cash/bank + gold &
 * jewelry assets + investments flagged zakatable, minus outstanding debt -
 * every figure pulled live from Net Worth/Investments/Debts, entered once.
 * Nisab tracks the market gold/silver price, which this app has no live
 * feed for, so it starts UNVERIFIED until the household confirms it. */
export default function ZakatScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data: estimate, isLoading } = useZakatEstimate()
  const { data: config } = useZakatConfig()
  const patchConfig = usePatchZakatConfig()
  const [editing, setEditing] = useState(false)
  const [nisabText, setNisabText] = useState('')
  const [rateText, setRateText] = useState('')

  function startEdit() {
    if (!config) return
    setNisabText(String(config.nisab_threshold / 100))
    setRateText(String(config.rate_bps / 100))
    setEditing(true)
  }

  function save() {
    const nisab = parseTakaInput(nisabText)
    const rate = rateText.trim() ? Number(rateText) : null
    if (nisab == null || rate == null || Number.isNaN(rate)) return
    patchConfig.mutate(
      { nisab_threshold: nisab, rate_bps: Math.round(rate * 100), verified: true },
      { onSuccess: () => setEditing(false) },
    )
  }

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <button onClick={onBack} className="text-sm text-neutral-500">
        ← {t('settings.title')}
      </button>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('zakat.title')}</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}

      {estimate && !estimate.verified && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          {t('zakat.unverified')}
        </p>
      )}

      {estimate && (
        <>
          <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
              {t('zakat.due')}
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-900">
              {formatTakaSigned(estimate.zakat_due, locale)}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {estimate.meets_nisab ? t('zakat.meetsNisab') : t('zakat.belowNisab')}
            </p>
          </div>

          <h2 className="mt-6 text-sm font-medium text-neutral-700">{t('zakat.breakdown')}</h2>
          <dl className="mt-2 space-y-1.5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm">
            <Row label={t('zakat.cashAndBank')} value={formatTakaSigned(estimate.cash_and_bank, locale)} />
            <Row label={t('zakat.goldAndJewelry')} value={formatTakaSigned(estimate.gold_and_jewelry, locale)} />
            <Row label={t('zakat.zakatableInvestments')} value={formatTakaSigned(estimate.zakatable_investments, locale)} />
            <Row label={t('zakat.liabilities')} value={`− ${formatTakaSigned(estimate.liabilities, locale)}`} tone="text-red-600" />
            <Row label={t('zakat.zakatableWealth')} value={formatTakaSigned(estimate.zakatable_wealth, locale)} tone="font-semibold" />
            <Row label={t('zakat.nisabThreshold')} value={formatTakaSigned(estimate.nisab_threshold, locale)} />
            <Row label={t('zakat.rate')} value={`${(estimate.rate_bps / 100).toFixed(2)}%`} />
          </dl>

          {editing ? (
            <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <input
                inputMode="decimal"
                value={nisabText}
                onChange={(e) => setNisabText(e.target.value)}
                placeholder={`${t('zakat.nisabThreshold')} ৳`}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                inputMode="decimal"
                value={rateText}
                onChange={(e) => setRateText(e.target.value)}
                placeholder={`${t('zakat.rate')} %`}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={patchConfig.isPending}
                  className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {t('zakat.save')}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
                  {t('zakat.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={startEdit} className="mt-4 text-sm font-medium text-brand-700">
              {t('zakat.updateNisab')}
            </button>
          )}
        </>
      )}
    </main>
  )
}

function Row({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`tabular-nums ${tone}`}>{value}</dd>
    </div>
  )
}
