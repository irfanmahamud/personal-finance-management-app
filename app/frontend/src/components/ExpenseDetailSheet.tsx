import { useTranslation } from 'react-i18next'
import { formatTakaSigned, type Locale } from '../lib/money'
import {
  fetchReceiptUrl,
  useDeleteExpense,
  usePaymentMethods,
  type Expense,
} from '../lib/queries'
import { IconTrash } from './icons'

/** Read/act detail view for one expense - the bottom sheet is the app's
 * one sanctioned modal shape (matches QuickAdd); editing still hands off
 * to the existing inline edit-row rather than duplicating a form here. */
export default function ExpenseDetailSheet({
  expense: e,
  bn,
  locale,
  icon,
  forLabel,
  onClose,
  onEdit,
}: {
  expense: Expense
  bn: boolean
  locale: Locale
  icon: string | null
  forLabel: string
  onClose: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const del = useDeleteExpense()
  const { data: paymentMethods } = usePaymentMethods()
  const paymentMethod = paymentMethods?.find((p) => p.id === e.payment_method_id)

  async function viewReceipt() {
    if (!e.receipt_id) return
    const url = await fetchReceiptUrl(e.receipt_id)
    window.open(url, '_blank')
  }

  function onDelete() {
    if (!confirm(t('expenses.confirmDelete'))) return
    del.mutate(e.id, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e2) => e2.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl">
              {icon ?? '·'}
            </span>
            <div>
              <p className="text-base font-bold text-neutral-900">
                {bn ? e.category_name_bn : e.category_name_en}
              </p>
              <p className="text-xs text-neutral-400">{e.date}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('expenses.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-neutral-400 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>

        <p className="mt-4 text-3xl font-bold tabular-nums text-neutral-900">
          {formatTakaSigned(e.amount_bdt, locale)}
        </p>

        <dl className="mt-4 space-y-2.5 text-sm">
          {e.description && (
            <Row label={t('expenses.description')} value={e.description} />
          )}
          <Row label={t('entry.for')} value={forLabel} />
          {paymentMethod && (
            <Row
              label={t('expenses.paymentMethod')}
              value={`${paymentMethod.icon ?? ''} ${bn && paymentMethod.name_bn ? paymentMethod.name_bn : paymentMethod.name}`}
            />
          )}
        </dl>

        {e.receipt_id && (
          <button
            onClick={() => void viewReceipt()}
            className="mt-4 text-sm font-medium text-brand-700"
          >
            📎 {t('expenses.viewReceipt')}
          </button>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white"
          >
            {t('expenses.edit')}
          </button>
          <button
            onClick={onDelete}
            disabled={del.isPending}
            aria-label={t('expenses.delete')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 text-red-600 disabled:opacity-40"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-neutral-400">{label}</dt>
      <dd className="text-right text-neutral-900">{value}</dd>
    </div>
  )
}
