import { useTranslation } from 'react-i18next'
import ExpenseEntryPanel from './ExpenseEntryPanel'

/**
 * Mobile quick-add: bottom sheet over a scrim, instant-save mode —
 * tapping a category saves (the 5-second rule outranks the desktop
 * mock's explicit Log button). Tap-outside-to-dismiss already closes it;
 * the X is just an explicit affordance for anyone who doesn't try that.
 */
export default function QuickAdd({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            onClick={onClose}
            aria-label={t('expenses.close')}
            className="-mr-1.5 -mt-1.5 flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-neutral-400 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>
        <ExpenseEntryPanel instantSave onDone={onClose} />
      </div>
    </div>
  )
}
