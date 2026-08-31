import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useAssets,
  useCreateAsset,
  useDeleteAsset,
  useNetWorth,
  useNetWorthHistory,
  usePatchAsset,
  type Asset,
  type AssetCategory,
} from '../lib/queries'

const ASSET_CATEGORIES: AssetCategory[] = ['cash_bank', 'property', 'vehicle', 'gold_jewelry', 'other']

/** Net worth (spec §3.10): manually-valued assets + investments (pulled
 * live from the Investment table) minus debts (pulled live from Debt) -
 * every figure entered exactly once. Viewing this screen upserts a
 * monthly snapshot server-side, which is what feeds the line chart. */
export default function NetWorthScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const { data: net } = useNetWorth()
  const { data: history } = useNetWorthHistory()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: assets, isLoading } = useAssets(showInactive)

  const chartData = (history ?? []).map((h) => ({
    month: h.snapshot_date.slice(0, 7),
    netWorth: h.net_worth / 100,
  }))

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <button onClick={onBack} className="text-sm text-neutral-500">
        ← {t('settings.title')}
      </button>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('networth.title')}</h1>

      {net && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-400">
            {t('networth.netWorth')}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${net.net_worth < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
            {formatTakaSigned(net.net_worth, locale)}
          </p>
          <div className="mt-2 flex justify-between text-sm text-neutral-500">
            <span>
              {t('networth.totalAssets')}: {formatTakaSigned(net.total_assets, locale)}
            </span>
            <span>
              {t('networth.totalLiabilities')}: {formatTakaSigned(net.total_liabilities, locale)}
            </span>
          </div>
        </div>
      )}

      {chartData.length > 1 ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">{t('networth.history')}</p>
          <div className="mt-2 h-44">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v) => `৳${Number(v).toLocaleString('en-IN')}`} />
                <Line type="monotone" dataKey="netWorth" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-neutral-400">{t('networth.noHistory')}</p>
      )}

      <p className="mt-3 text-[11px] text-neutral-400">{t('networth.manualNote')}</p>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700">{t('networth.assets')}</h2>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('networth.showInactive')}
        </label>
      </div>

      {isLoading && <p className="mt-2 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (assets?.length ?? 0) === 0 && !adding && (
        <p className="mt-2 text-sm text-neutral-400">{t('networth.empty')}</p>
      )}

      <ul className="mt-2 space-y-2">
        {assets?.map((a) => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </ul>

      {adding ? (
        <AssetForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-emerald-700"
        >
          + {t('networth.addAsset')}
        </button>
      )}
    </main>
  )
}

function AssetCard({ asset }: { asset: Asset }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const patch = usePatchAsset()
  const del = useDeleteAsset()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <AssetForm asset={asset} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-neutral-900">{asset.name}</p>
          <p className="text-xs text-neutral-400">
            {t(`networth.categories.${asset.category}`)} · {asset.valued_on}
          </p>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
          {formatTakaSigned(asset.value, locale)}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-emerald-700">
          {t('networth.edit')}
        </button>
        {asset.active ? (
          <button
            onClick={() => patch.mutate({ id: asset.id, active: false })}
            className="text-xs text-neutral-400"
          >
            {t('networth.deactivate')}
          </button>
        ) : (
          <>
            <button
              onClick={() => patch.mutate({ id: asset.id, active: true })}
              className="text-xs text-neutral-400"
            >
              {t('networth.reactivate')}
            </button>
            <button onClick={() => del.mutate(asset.id)} className="text-xs text-red-600">
              {t('recurring.delete')}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function AssetForm({ asset, onDone }: { asset?: Asset; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateAsset()
  const patch = usePatchAsset()
  const mutation = asset ? patch : create

  const [category, setCategory] = useState<AssetCategory>(asset?.category ?? 'cash_bank')
  const [name, setName] = useState(asset?.name ?? '')
  const [valueText, setValueText] = useState(asset ? String(asset.value / 100) : '')
  const [notes, setNotes] = useState(asset?.notes ?? '')

  const value = parseTakaInput(valueText)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (value == null) return
    const body = { category, name, value, notes: notes || null }
    if (asset) {
      patch.mutate({ id: asset.id, ...body }, { onSuccess: onDone })
    } else {
      create.mutate(body, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as AssetCategory)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        {ASSET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`networth.categories.${c}`)}
          </option>
        ))}
      </select>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('networth.name')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        inputMode="decimal"
        value={valueText}
        onChange={(e) => setValueText(e.target.value)}
        placeholder={`${t('networth.value')} ৳`}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('debts.notes')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        rows={2}
      />
      {mutation.isError && <p className="text-xs text-red-600">{t('networth.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={mutation.isPending || value == null}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {asset ? t('networth.save') : t('networth.addAsset')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('networth.cancel')}
        </button>
      </div>
    </form>
  )
}
