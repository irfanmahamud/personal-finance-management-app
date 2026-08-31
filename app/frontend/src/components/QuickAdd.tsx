import ExpenseEntryPanel from './ExpenseEntryPanel'

/**
 * Mobile quick-add: bottom sheet over a scrim, instant-save mode —
 * tapping a category saves (the 5-second rule outranks the desktop
 * mock's explicit Log button).
 */
export default function QuickAdd({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <ExpenseEntryPanel instantSave onDone={onClose} />
      </div>
    </div>
  )
}
